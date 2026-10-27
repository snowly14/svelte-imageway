import ts from 'typescript';
import { mkdir, cp, readFile, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { execute, environment, summary } from '../photographic/common.ts';
const target = resolve('.local/multiplex/experimental/package');
await mkdir(target, { recursive: true });
await cp('.local/component-3.1.8/baseline/package', target, {
  recursive: true,
  filter: (p) => !p.includes('node_modules') && !p.includes('/src'),
});
const transpiler = {
  transformSync: (source: string) =>
    ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    }).outputText,
};
for (const name of ['experimental-worker', 'experimental-sharp-worker']) {
  const source = (await readFile(`bench/multiplex/${name}.ts`, 'utf8'))
    .replace('../../packages/svelte-imageway/src/lib/node/pipeline.js', './pipeline.js')
    .replace('../../packages/svelte-imageway/src/lib/core/errors.js', '../core/errors.js');
  await writeFile(join(target, 'dist/node', name + '.js'), transpiler.transformSync(source));
}
const pool = join(target, 'dist/node/pool.js'),
  text = await readFile(pool, 'utf8');
if (!text.includes("from 'node:worker_threads'")) throw Error('Unexpected pool source');
await writeFile(
  pool,
  text.replace("from 'node:worker_threads'", "from './experimental-worker.js'"),
);
const rows: Array<{
    corpus: string;
    variant: string;
    round: number;
    buildMs: number;
    peakRssBytes: number;
    assets: Array<{ bytes: number; sha256: string }>;
  }> = [],
  env = await environment();
for (const corpus of ['photographic', 'synthetic'])
  for (let round = 0; round < 3; round++)
    for (const variant of round % 2 ? ['experimental', 'before'] : ['before', 'experimental']) {
      const root = resolve('.local/multiplex/work', corpus, variant);
      await mkdir(root, { recursive: true });
      const fixture = resolve('.local/sparse-colour/work/comparison', corpus, 'baseline');
      for (const file of (await (await import('node:fs/promises')).readdir(fixture)).filter((n) =>
        /\.(?:png|jpg|js|html)$/.test(n),
      ))
        await cp(join(fixture, file), join(root, file));
      await rm(join(root, 'node_modules/.cache'), { recursive: true, force: true });
      const { stdout } = await execute(
        'node',
        [
          resolve('bench/build-workers/child.ts'),
          'imageway',
          root,
          variant === 'before' ? resolve('.local/component-3.1.8/baseline/package') : target,
          '4',
        ],
        { cwd: root, timeout: 300000, maxBuffer: 2000000 },
      );
      const row = JSON.parse(stdout.trim()) as (typeof rows)[number];
      const expected = rows.find((r) => r.corpus === corpus);
      if (
        expected &&
        JSON.stringify(expected.assets.map((a) => [a.bytes, a.sha256])) !==
          JSON.stringify(row.assets.map((a) => [a.bytes, a.sha256]))
      )
        throw Error('Encoded bytes changed');
      rows.push({ ...row, corpus, variant, round });
      console.log(corpus, variant, row.buildMs, row.peakRssBytes / 1048576);
      await writeFile(
        '.local/multiplex/probe.json',
        JSON.stringify(
          {
            complete: rows.length === 12,
            environment: env,
            protocol:
              'Unshippable success-path scheduling experiment:4logical jobs in1physicalNodeworker, nativeSharp/libvips encoders unchanged. Three alternating fresh-process cold pairs. Tool caches removed, OS cache warm. Exact encoded bytes required. Deadline/failure isolation is not implemented and must gate any future implementation.',
            rows,
          },
          null,
          2,
        ) + '\n',
      );
    }
console.log(
  JSON.stringify(
    ['photographic', 'synthetic'].map((corpus) => ({
      corpus,
      ...Object.fromEntries(
        ['before', 'experimental'].map((variant) => {
          const r = rows.filter((r) => r.corpus === corpus && r.variant === variant);
          return [
            variant,
            {
              buildMs: summary(r.map((r) => r.buildMs)),
              rss: summary(r.map((r) => r.peakRssBytes / 1048576)),
            },
          ];
        }),
      ),
    })),
    null,
    2,
  ),
);

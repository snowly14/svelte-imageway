import { mkdir, cp, readFile, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { execute, environment, summary, digest, names, corpus } from '../photographic/common.ts';
import { verifyCorpus } from '../lean-preview/corpus.ts';
const baseline = resolve('.local/rust-blurhash/baseline/package');
if (
  digest(await readFile('.local/rust-blurhash/baseline.tgz')) !==
  'f136df477dc8cc625caf0d9a39e39242a92c0cb7ee307a48956f89d7ed664644'
)
  throw Error('Unexpected baseline archive.');
const inputs = await verifyCorpus(),
  env = await environment();
const directory = resolve('bench/results/blurhash-display-3.1.3');
await mkdir(directory, { recursive: true });
type Row = {
  scenario: string;
  variant: string;
  pair: number;
  cache: string;
  buildMs: number;
  peakRssBytes: number;
  assets: Array<{ bytes: number; sha256: string }>;
  processWallMs: number;
};
const rows: Row[] = [];
for (const scenario of ['blurhash', 'lqip']) {
  let expected: string | undefined;
  for (const variant of ['before', 'after']) {
    const root = resolve('.local/rust-blurhash/build', scenario, variant);
    await mkdir(root, { recursive: true });
    for (const name of names) await cp(join(corpus, name), join(root, name));
    await writeFile(join(root, 'index.html'), '<script type="module" src="/main.js"></script>');
    await writeFile(
      join(root, 'main.js'),
      names
        .map(
          (name, i) =>
            `import p${i} from './${name}?img&w=288;384;480&format=webp&q=75&fit=inside&placeholder=${scenario}';console.log(p${i});`,
        )
        .join('\n'),
    );
  }
  for (let pair = 0; pair < 7; pair++)
    for (const variant of pair % 2 ? ['after', 'before'] : ['before', 'after']) {
      const root = resolve('.local/rust-blurhash/build', scenario, variant);
      await rm(join(root, 'node_modules/.cache'), { recursive: true, force: true });
      for (const cache of ['cold', 'warm']) {
        const started = performance.now();
        const { stdout } = await execute(
          'node',
          [
            resolve('bench/photographic/build-child.ts'),
            'imageway',
            root,
            variant === 'before' ? baseline : resolve('packages/svelte-imageway'),
          ],
          { cwd: root, timeout: 300000, maxBuffer: 2000000 },
        );
        const row = JSON.parse(stdout.trim()) as Row,
          actual = JSON.stringify(row.assets.map(({ bytes, sha256 }) => ({ bytes, sha256 })));
        expected ??= actual;
        if (actual !== expected || row.assets.length !== 72)
          throw Error('Build byte-identity gate failed.');
        rows.push({
          ...row,
          scenario,
          variant,
          pair,
          cache,
          processWallMs: performance.now() - started,
        });
        await writeFile(
          join(directory, 'build.json'),
          JSON.stringify(
            {
              complete: rows.length === 56,
              environment: env,
              baselineVersion: '3.1.2',
              inputs,
              protocol:
                'Seven alternating fresh-Node cold/warm pairs per BlurHash/LQIP strategy; 24 pinned Kodak photos, explicit 288/384/480px WebPq75 fitinside,72byte-identical emitted images per build. Delete tool caches before every cold build, keep caches for immediate fresh-process warm build, OS cache unflushed. buildMs includes plugin loading and Vite build, common Vite/Svelte imports outside timer. processWallMs includes process startup and output validation. Native concurrency uses tool defaults. Full preview JSON equality is separately gated by run.ts; LQIP is an unchanged control. Suites serial.',
              rows,
            },
            null,
            2,
          ) + '\n',
        );
        console.log(`${scenario} ${pair + 1}/7 ${variant} ${cache}: ${row.buildMs.toFixed(2)} ms`);
      }
    }
}
await writeFile(
  join(directory, 'build-summary.json'),
  JSON.stringify(
    ['blurhash', 'lqip'].flatMap((scenario) =>
      ['before', 'after'].flatMap((variant) =>
        ['cold', 'warm'].map((cache) => {
          const selected = rows.filter(
            (r) => r.scenario === scenario && r.variant === variant && r.cache === cache,
          );
          return {
            scenario,
            variant,
            cache,
            buildMs: summary(selected.map((r) => r.buildMs)),
            processWallMs: summary(selected.map((r) => r.processWallMs)),
            peakRssBytes: summary(selected.map((r) => r.peakRssBytes)),
          };
        }),
      ),
    ),
    null,
    2,
  ) + '\n',
);

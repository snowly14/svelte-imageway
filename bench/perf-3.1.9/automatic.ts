import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { execute, environment, summary, names, digest } from '../photographic/common.ts';
import { verifyCorpus } from '../lean-preview/corpus.ts';
const directory = resolve('bench/results/perf-3.1.9');
const study = process.argv.find((v) => v.startsWith('--study='))?.slice(8) ?? 'coalesced-automatic';
if (!/^[a-z-]+$/.test(study)) throw Error('Invalid study label.');
const candidate =
  process.argv.find((v) => v.startsWith('--candidate='))?.slice(12) ??
  '.local/component-3.1.9/candidate/package';
const pairs = Number(process.argv.find((v) => v.startsWith('--pairs='))?.slice(8) ?? 3);
if (!Number.isSafeInteger(pairs) || pairs < 3 || pairs > 21) throw Error('Invalid pair count.');
const output = join(directory, study + '.json');
try {
  await readFile(output);
  throw Error('Preserve existing results.');
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}
const inputs = await verifyCorpus(),
  env = await environment();
if (
  digest(await readFile('.local/release-3.1.8/svelte-imageway-3.1.8.tgz')) !==
  '7d4b09a7140a79204c4b4a77bf8fabecc81c8aecc7d16c09b016ce549efd9480'
)
  throw Error('Unexpected baseline.');
const rows: Array<{
  variant: string;
  pair: number;
  cache: string;
  buildMs: number;
  peakRssBytes: number;
  assets: Array<{ bytes: number; sha256: string }>;
  processWallMs: number;
}> = [];
let expected: string | undefined;
for (const variant of ['baseline', 'candidate']) {
  const root = resolve('.local/component-3.1.9', study, variant);
  await mkdir(root, { recursive: true });
  for (const name of names) await cp(join('.local/photographic/corpus', name), join(root, name));
  await writeFile(join(root, 'index.html'), '<script type="module" src="/main.js"></script>');
  await writeFile(
    join(root, 'main.js'),
    names.map((name, i) => `import p${i} from './${name}';console.log(p${i});`).join('\n'),
  );
}
for (let pair = 0; pair < pairs; pair++)
  for (const variant of pair % 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate']) {
    const root = resolve('.local/component-3.1.9', study, variant);
    await rm(join(root, 'node_modules/.cache'), { recursive: true, force: true });
    for (const cache of ['cold', 'warm']) {
      const started = performance.now();
      const { stdout } = await execute(
        'node',
        [
          resolve('bench/improvements/child.ts'),
          'build',
          resolve(variant === 'baseline' ? '.local/component-3.1.9/baseline/package' : candidate),
          root,
          'automatic',
        ],
        { cwd: root, timeout: 300000, maxBuffer: 2000000 },
      );
      const row = JSON.parse(stdout.trim()) as (typeof rows)[number];
      const actual = JSON.stringify(row.assets.map(({ bytes, sha256 }) => ({ bytes, sha256 })));
      expected ??= actual;
      if (actual !== expected) throw Error('Default output byte identity failed.');
      rows.push({ ...row, variant, pair, cache, processWallMs: performance.now() - started });
      await writeFile(
        output,
        JSON.stringify(
          {
            complete: rows.length === pairs * 4,
            environment: env,
            inputs,
            baselineVersion: '3.1.8',
            candidateRoot: resolve(candidate),
            protocol: `${pairs} alternating fresh-Node cold/warm pairs, all24 pinned Kodak photos, ordinary imports with unchanged default widths/AVIF/WebP/JPEG quality/pruning/LQIP and four logical transforms. Both versions use one physical build worker. Retain original raster assets. Tool caches cleared for cold; immediate fresh-process warm. buildMs includes plugin loading and build, excludes common harness imports and output verification. Every encoded/original asset byte/SHA multiset must match all variants, repeats and cache states. Single busy desktop, no OS cache flush, serial suites. No cross-tool/default-quality comparison.`,
            rows,
          },
          null,
          2,
        ) + '\n',
      );
      console.log(
        `${pair + 1}/${pairs} ${variant} ${cache}: ${row.buildMs.toFixed(1)}ms ${(row.peakRssBytes / 1048576).toFixed(1)}MiB, ${row.assets.length} files`,
      );
    }
  }
await writeFile(
  join(directory, study + '-summary.json'),
  JSON.stringify(
    ['baseline', 'candidate'].flatMap((variant) =>
      ['cold', 'warm'].map((cache) => {
        const selected = rows.filter((r) => r.variant === variant && r.cache === cache);
        return {
          variant,
          cache,
          buildMs: summary(selected.map((r) => r.buildMs)),
          peakRssMiB: summary(selected.map((r) => r.peakRssBytes / 1048576)),
          processWallMs: summary(selected.map((r) => r.processWallMs)),
          imageCount: selected[0]!.assets.length,
          imageBytes: selected[0]!.assets.reduce((n, a) => n + a.bytes, 0),
        };
      }),
    ),
    null,
    2,
  ) + '\n',
);

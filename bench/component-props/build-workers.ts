import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { digest, environment, execute, summary, names } from '../photographic/common.ts';
import { verifyCorpus } from '../lean-preview/corpus.ts';

const study = process.argv[2] ?? 'baseline';
if (!/^[a-z-]+$/.test(study)) throw Error('Invalid study name.');
const directory = resolve(
  process.argv.find((v) => v.startsWith('--output-dir='))?.slice('--output-dir='.length) ??
    'bench/results/sparse-colour-3.1.8',
);
await mkdir(directory, { recursive: true });
const output = join(directory, study + '.json');
try {
  await readFile(output);
  throw Error('Preserve existing results; choose a new study name.');
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}
await verifyCorpus();
const env = await environment();
const inputs: Array<{ corpus: string; name: string; bytes: number; sha256: string }> = [];
const rows: Array<{
  corpus: string;
  round: number;
  variant: string;
  cache: string;
  workers: number | null;
  buildMs: number;
  peakRssBytes: number;
  processWallMs: number;
  assets: Array<{ bytes: number; sha256: string }>;
}> = [];
const baseline = resolve('.local/component-3.1.8/baseline/package');
if (
  digest(await readFile('.local/component-3.1.8/baseline.tgz')) !==
  'dd67a03d7c7a27dba607a838d1460117710e8a3fecca2ff0bf16cd89e60a2535'
)
  throw Error('Unexpected baseline.');
const variants =
  study === 'baseline'
    ? ['one', 'two', 'four']
    : ['baseline', 'candidate', 'imagetools', 'enhanced-img'];
const counts: Record<string, number> = { one: 1, two: 2, four: 4 };
const corpora = [
  { name: 'photographic', directory: '.local/photographic/corpus', names },
  {
    name: 'synthetic',
    directory: '.local/bench/fixtures',
    names: ['landscape.png', 'texture.jpg', 'chart.png'],
  },
];
for (const corpus of corpora) {
  let expected: string | undefined;
  for (const name of corpus.names) {
    const data = await readFile(join(corpus.directory, name));
    inputs.push({ corpus: corpus.name, name, bytes: data.length, sha256: digest(data) });
  }
  for (const variant of variants) {
    const root = resolve('.local/sparse-colour/work', study, corpus.name, variant);
    await mkdir(root, { recursive: true });
    for (const name of corpus.names) await cp(join(corpus.directory, name), join(root, name));
    const imageway = !['imagetools', 'enhanced-img'].includes(variant);
    const query = imageway
      ? 'img&w=288;384;480&format=webp&q=75&fit=inside&placeholder=none'
      : `${variant === 'enhanced-img' ? 'enhanced&' : ''}w=288;384;480&format=webp&quality=75&fit=inside&as=picture`;
    await writeFile(join(root, 'index.html'), '<script type="module" src="/main.js"></script>');
    await writeFile(
      join(root, 'main.js'),
      corpus.names
        .map((name, i) => `import p${i} from './${name}?${query}';console.log(p${i});`)
        .join('\n'),
    );
  }
  for (let round = 0; round < 7; round++) {
    const order = [
      ...variants.slice(round % variants.length),
      ...variants.slice(0, round % variants.length),
    ];
    if (round % 2) order.reverse();
    for (const variant of order) {
      const root = resolve('.local/sparse-colour/work', study, corpus.name, variant);
      await rm(join(root, 'node_modules/.cache'), { recursive: true, force: true });
      for (const cache of ['cold', 'warm']) {
        const start = performance.now();
        const { stdout } = await execute(
          'node',
          [
            resolve('bench/build-workers/child.ts'),
            ['imagetools', 'enhanced-img'].includes(variant) ? variant : 'imageway',
            root,
            variant === 'candidate' ? resolve('packages/svelte-imageway') : baseline,
            String(counts[variant] ?? 0),
          ],
          { cwd: root, timeout: 300000, maxBuffer: 2000000 },
        );
        const row = JSON.parse(stdout.trim()) as (typeof rows)[number];
        const actual = JSON.stringify(row.assets.map(({ bytes, sha256 }) => ({ bytes, sha256 })));
        expected ??= actual;
        if (actual !== expected || row.assets.length !== corpus.names.length * 3)
          throw Error(`Byte identity failed: ${corpus.name}/${variant}/${round}/${cache}`);
        rows.push({
          ...row,
          corpus: corpus.name,
          round,
          variant,
          cache,
          workers: counts[variant] ?? null,
          processWallMs: performance.now() - start,
        });
        await writeFile(
          output,
          JSON.stringify(
            {
              complete: rows.length === corpora.length * 7 * variants.length * 2,
              environment: env,
              baselineVersion: '3.1.7',
              inputs,
              protocol:
                'Seven rotated/reversed fresh-Node rounds per corpus/configuration, each cold deletes tool caches and immediately repeats warm in a fresh process. OS cache unflushed, serial suites, no concurrent heavy checks. Explicit 288/384/480px WebP q75 fitinside no preview; competitors quality75. Identical sorted asset byte/SHA multisets required across all rounds/configurations/tools. buildMs includes tool import, common Vite/Svelte imports outside timer; processWallMs includes startup and verification; process peak RSS includes workers. Baseline study uses explicit workers1/2/4 in frozen3.1.7; comparisons use tool native defaults.',
              rows,
            },
            null,
            2,
          ) + '\n',
        );
        console.log(
          `${corpus.name} ${round + 1}/7 ${variant} ${cache}: ${row.buildMs.toFixed(2)}ms ${(row.peakRssBytes / 1048576).toFixed(1)}MiB`,
        );
      }
    }
  }
}
await writeFile(
  join(directory, study + '-summary.json'),
  JSON.stringify(
    corpora.flatMap((corpus) =>
      variants.flatMap((variant) =>
        ['cold', 'warm'].map((cache) => {
          const selected = rows.filter(
            (row) => row.corpus === corpus.name && row.variant === variant && row.cache === cache,
          );
          return {
            corpus: corpus.name,
            variant,
            cache,
            buildMs: summary(selected.map((row) => row.buildMs)),
            peakRssMiB: summary(selected.map((row) => row.peakRssBytes / 1048576)),
            processWallMs: summary(selected.map((row) => row.processWallMs)),
            imageCount: selected[0]!.assets.length,
            imageBytes: selected[0]!.assets.reduce((n, asset) => n + asset.bytes, 0),
          };
        }),
      ),
    ),
    null,
    2,
  ) + '\n',
);

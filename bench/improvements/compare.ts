import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { execute, environment, prepare, summary, digest } from '../photographic/common.ts';

const baseline = resolve(process.argv[2] ?? '.local/perf-3.1/baseline/package');
if (
  digest(await readFile('.local/release-3.0.1/svelte-imageway-3.0.1.tgz')) !==
  '9c681cc39e4bdb2116ad24de59d49b650f4c58283294edacd73c4958db0c15e2'
)
  throw Error('Unexpected baseline archive.');
await prepare();
const resultDir = resolve('bench/results/improvements-3.1');
await mkdir(resultDir, { recursive: true });
const env = await environment();
const engines = ['imageway', 'imagetools', 'enhanced-img', 'imageway-baseline'];
interface Row {
  corpus: string;
  round: number;
  cache: string;
  engine: string;
  buildMs: number;
  peakRssBytes: number;
  processWallMs: number;
  assets: Array<{ bytes: number; sha256: string }>;
}
const rows: Row[] = [];
const corpora = [
  {
    name: 'photographic',
    dir: '.local/photographic/corpus',
    names: Array.from({ length: 24 }, (_, i) => `kodim${String(i + 1).padStart(2, '0')}.png`),
    formats: 'webp',
  },
  {
    name: 'synthetic',
    dir: '.local/bench/fixtures',
    names: ['landscape.png', 'texture.jpg', 'chart.png'],
    formats: 'webp',
  },
];
const inputs = [];
for (const corpus of corpora) {
  for (const name of corpus.names) {
    const bytes = await readFile(join(corpus.dir, name));
    inputs.push({ corpus: corpus.name, name, bytes: bytes.length, sha256: digest(bytes) });
  }
  let expected: string | undefined;
  for (const engine of engines) {
    const root = resolve('.local/perf-3.1/comparison', corpus.name, engine);
    await mkdir(root, { recursive: true });
    for (const name of corpus.names) await cp(join(corpus.dir, name), join(root, name));
    await writeFile(join(root, 'index.html'), '<script type="module" src="/main.js"></script>');
    const query = engine.startsWith('imageway')
      ? `img&w=288;384;480&format=${corpus.formats}&q=75&fit=inside&placeholder=none`
      : `${engine === 'enhanced-img' ? 'enhanced&' : ''}w=288;384;480&format=${corpus.formats}&quality=75&fit=inside&as=picture`;
    await writeFile(
      join(root, 'main.js'),
      corpus.names
        .map((name, i) => `import p${i} from './${name}?${query}';console.log(p${i});`)
        .join('\n'),
    );
  }
  for (let round = 0; round < 7; round++) {
    const order = [...engines.slice(round % 4), ...engines.slice(0, round % 4)];
    if (round % 2) order.reverse();
    for (const engine of order) {
      const root = resolve('.local/perf-3.1/comparison', corpus.name, engine);
      await rm(join(root, 'node_modules/.cache'), { recursive: true, force: true });
      for (const cache of ['cold', 'warm']) {
        const start = performance.now();
        const { stdout } = await execute(
          'node',
          [
            resolve('bench/photographic/build-child.ts'),
            engine,
            root,
            engine === 'imageway-baseline' ? baseline : resolve('packages/svelte-imageway'),
          ],
          { cwd: root, maxBuffer: 2_000_000, timeout: 300000 },
        );
        const result = JSON.parse(stdout.trim()) as Row;
        const actual = JSON.stringify(
          result.assets.map(({ bytes, sha256 }) => ({ bytes, sha256 })),
        );
        expected ??= actual;
        if (
          actual !== expected ||
          result.assets.length !== (corpus.name === 'photographic' ? 72 : 9)
        )
          throw Error(`Output identity failed: ${corpus.name}/${engine}/${round}/${cache}`);
        rows.push({
          ...result,
          corpus: corpus.name,
          round,
          cache,
          processWallMs: performance.now() - start,
        });
        await writeFile(
          join(resultDir, 'comparison.json'),
          JSON.stringify(
            {
              environment: env,
              baselineVersion: '3.0.1',
              protocol:
                'Seven rotated/interleaved fresh-Node rounds per corpus, cold deletes all tool disk caches; immediate warm fresh-process repeat. Photographic: 24 pinned Kodak inputs. Synthetic: three deterministic 1200x800 fixtures. WebP q75, widths 288/384/480 produce integer heights. Explicit fit=inside, no preview, no inlining. Imageway q=75; competitors quality=75. Identical asset byte/SHA multisets across engines, rounds and cache states required. Native concurrency uses each tool defaults. buildMs starts before tool import and ends before asset verification; common Vite/Svelte imports outside timer for all engines. processWallMs includes setup/verification. OS cache unflushed, single uncontrolled desktop.',
              inputs,
              rows,
            },
            null,
            2,
          ) + '\n',
        );
        console.log(
          `${corpus.name} ${round + 1}/7 ${engine} ${cache}: ${result.buildMs.toFixed(1)} ms`,
        );
      }
    }
  }
}
await writeFile(
  join(resultDir, 'comparison-summary.json'),
  JSON.stringify(
    corpora.flatMap((corpus) =>
      engines.flatMap((engine) =>
        ['cold', 'warm'].map((cache) => {
          const selected = rows.filter(
            (row) => row.corpus === corpus.name && row.engine === engine && row.cache === cache,
          );
          return {
            corpus: corpus.name,
            engine,
            cache,
            buildMs: summary(selected.map((row) => row.buildMs)),
            peakRssBytes: summary(selected.map((row) => row.peakRssBytes)),
            processWallMs: summary(selected.map((row) => row.processWallMs)),
            imageFiles: selected[0]!.assets.length,
            imageBytes: selected[0]!.assets.reduce((n, asset) => n + asset.bytes, 0),
          };
        }),
      ),
    ),
    null,
    2,
  ) + '\n',
);

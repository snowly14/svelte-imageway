import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { digest, environment, execute, summary } from '../photographic/common.ts';
import { verifyCorpus } from '../lean-preview/corpus.ts';
const directory = resolve('bench/results/perf-3.1.9');
const output = join(directory, 'pipeline.json');
try {
  await readFile(output);
  throw Error('Preserve existing results.');
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
}
await mkdir(directory, { recursive: true });
if (
  digest(await readFile('.local/release-3.1.8/svelte-imageway-3.1.8.tgz')) !==
  '7d4b09a7140a79204c4b4a77bf8fabecc81c8aecc7d16c09b016ce549efd9480'
)
  throw Error('Unexpected baseline archive.');
const corpus = await verifyCorpus(),
  env = await environment();
type Row = {
  variant: string;
  mode: string;
  round: number;
  perImageMs: number;
  outputCount: number;
  outputDigest: string;
  peakRssBytes: number;
};
const rows: Row[] = [];
for (const mode of ['no-preview', 'preview'])
  for (let round = 0; round < 7; round++)
    for (const variant of round % 2 ? ['after', 'before'] : ['before', 'after']) {
      const root = resolve(
        variant === 'before'
          ? '.local/component-3.1.9/baseline/package'
          : '.local/component-3.1.9/candidate/package',
      );
      const { stdout } = await execute(
        'node',
        [resolve('bench/perf-3.1.9/pipeline-child.ts'), root, mode],
        { timeout: 300000, maxBuffer: 1000000 },
      );
      const row = JSON.parse(stdout.trim()) as Row;
      if (
        row.outputCount !== 72 ||
        rows.some((r) => r.mode === mode && r.outputDigest !== row.outputDigest)
      )
        throw Error('Pipeline byte/metadata/preview identity failed.');
      rows.push({ ...row, variant, mode, round });
      await writeFile(
        output,
        JSON.stringify(
          {
            complete: rows.length === 28,
            environment: env,
            corpus,
            protocol:
              'Seven alternating fresh-Node pairs per mode, 24 pinned Kodak photos at 288/384/480 px WebP quality 75. One complete 72-image warm-up batch, then one timed batch. Main-process Sharp transform only; no filesystem reads in timing, no Vite or worker startup. Complete encoded bytes and metadata including preview/color must match within each mode. Peak process RSS, not JS heap. Serialized suites, OS caches unflushed.',
            rows,
          },
          null,
          2,
        ) + '\n',
      );
      console.log(
        `${mode} ${round + 1}/7 ${variant}: ${(row.perImageMs * 1000).toFixed(2)} us, ${(row.peakRssBytes / 1048576).toFixed(2)} MiB`,
      );
    }
await writeFile(
  join(directory, 'pipeline-summary.json'),
  JSON.stringify(
    ['no-preview', 'preview'].flatMap((mode) =>
      ['before', 'after'].map((variant) => {
        const r = rows.filter((r) => r.mode === mode && r.variant === variant);
        return {
          mode,
          variant,
          microseconds: summary(r.map((x) => x.perImageMs * 1000)),
          peakRssMiB: summary(r.map((x) => x.peakRssBytes / 1048576)),
        };
      }),
    ),
    null,
    2,
  ) + '\n',
);

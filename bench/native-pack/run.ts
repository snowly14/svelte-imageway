import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { digest, environment, execute, summary } from '../photographic/common.ts';
import { verifyCorpus } from '../lean-preview/corpus.ts';
if (!process.argv.includes('--final'))
  throw Error(
    'Historical native-pack period is immutable; use --final for the selected column implementation.',
  );
const requestedOutput = process.argv
  .find((v) => v.startsWith('--output-dir='))
  ?.slice('--output-dir='.length);
const directory =
  requestedOutput ??
  (process.argv.includes('--final')
    ? 'bench/results/column-projection-3.1.7'
    : 'bench/results/native-pack-3.1.7');
await mkdir(directory, { recursive: true });
try {
  await readFile(directory + '/measurements.json');
  throw Error('Preserve existing data.');
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
}
if (
  digest(await readFile('.local/release-3.1.6/svelte-imageway-3.1.6.tgz')) !==
  '665d5afdd4fc5caca74387541b143f8996c65eacf8cc4c1222c0f8903ede1a27'
)
  throw Error('Unexpected baseline.');
const inputs = await verifyCorpus(),
  env = await environment();
const roots: Record<string, string> = {
  before: '.local/native-pack-3.1.7/baseline/package',
  optimizedJS: '.local/native-pack-3.1.7/optimized/package',
  scalarRust: '.local/native-pack-3.1.7/scalar/package',
  columnRust: '.local/native-pack-3.1.7/column/package',
  after: 'packages/svelte-imageway',
};
const rows: Array<{
  mode: string;
  variant: string;
  round: number;
  perOperationMs: number;
  digest: string;
  peakRssBytes: number;
  initializationMs: number;
  firstBatchMs: number;
}> = [];
for (const mode of ['encode', 'blurhash', 'lqip'])
  for (let round = 0; round < 7; round++) {
    const variants =
      mode === 'lqip'
        ? ['before', 'after']
        : mode === 'encode'
          ? [
              'before',
              'optimizedJS',
              process.argv.includes('--final') ? 'columnRust' : 'scalarRust',
              'after',
            ]
          : ['before', 'optimizedJS', 'after'];
    const order = [
      ...variants.slice(round % variants.length),
      ...variants.slice(0, round % variants.length),
    ];
    if (round % 2) order.reverse();
    for (const variant of order) {
      const { stdout } = await execute(
        'node',
        [
          resolve('bench/native-pack/child.ts'),
          resolve(roots[variant]!),
          mode === 'encode' ? 'encode' : 'preview',
          mode === 'lqip' ? 'lqip' : 'blurhash',
        ],
        { timeout: 300000, maxBuffer: 1000000 },
      );
      const row = JSON.parse(stdout.trim()) as (typeof rows)[number],
        previous = rows.find((r) => r.mode === mode);
      if (previous && previous.digest !== row.digest)
        throw Error('Hash/preview byte identity failed.');
      rows.push({ ...row, mode, variant, round });
      await writeFile(
        directory + '/measurements.json',
        JSON.stringify(
          {
            complete: rows.length === 63,
            environment: env,
            inputs,
            baseline: '3.1.6',
            protocol:
              'Seven rotated/reversed fresh-Node sets. Encode:24pinned photos decoded to<=32x32RGBA before timing,25warm batches then500batches/12000encodes; consume hashes, identical complete hash digest required. Includes all host copies, validation, native calls, quantization/base83, immutable string output. OptimizedJS uses cached ASCII packing with the baseline scalar Rust projection; scalarRust uses new native packing with scalar projection; Historical after uses SIMD RG projection; --final after uses bounded column conversion plus optimized JS packing, columnRust isolates the Rust change with original JS packing. Preserve each coefficient accumulation order. Init and first batch separate. Full preview: first24 batch,onewarmbatch,then72sequential Sharp+color+hash+display previews,completeJSON digest required; unchangedLQIPcontrol. All suites serial; single uncontrolled host, no OS cache flush; kernel results are not image encoding/HTTP/build throughput.',
            rows,
          },
          null,
          2,
        ) + '\n',
      );
      console.log(`${mode} ${round + 1}/7 ${variant}: ${(row.perOperationMs * 1000).toFixed(3)}us`);
    }
  }
await writeFile(
  directory + '/summary.json',
  JSON.stringify(
    ['encode', 'blurhash', 'lqip'].flatMap((mode) =>
      [...new Set(rows.filter((r) => r.mode === mode).map((r) => r.variant))].map((variant) => {
        const selected = rows.filter((r) => r.mode === mode && r.variant === variant);
        return {
          mode,
          variant,
          microseconds: summary(selected.map((r) => r.perOperationMs * 1000)),
          initializationMs: summary(selected.map((r) => r.initializationMs)),
          firstBatchMs: summary(selected.map((r) => r.firstBatchMs)),
          peakRssMiB: summary(selected.map((r) => r.peakRssBytes / 1048576)),
        };
      }),
    ),
    null,
    2,
  ) + '\n',
);

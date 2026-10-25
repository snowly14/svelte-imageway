import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execute, environment, summary, digest } from '../photographic/common.ts';
import { verifyCorpus } from '../lean-preview/corpus.ts';
if (
  digest(await readFile('.local/rust-blurhash/baseline.tgz')) !==
  'f136df477dc8cc625caf0d9a39e39242a92c0cb7ee307a48956f89d7ed664644'
)
  throw Error('Unexpected baseline.');
const corpus = await verifyCorpus(),
  env = await environment();
type Row = {
  pair: number;
  variant: string;
  perOperationMs: number;
  firstBatchMs: number;
  initializationMs: number;
  peakRssBytes: number;
  digest: string;
};
const rows: Row[] = [],
  variants = ['cachedJS', 'thresholdJS', 'cachedU8', 'thresholdU8', 'rust'];
let expected: string | undefined;
for (let pair = 0; pair < 7; pair++) {
  const order = [...variants.slice(pair % 5), ...variants.slice(0, pair % 5)];
  if (pair % 2) order.reverse();
  for (const variant of order) {
    const { stdout } = await execute(
      'node',
      [resolve('bench/blurhash-display/child.ts'), variant, resolve('packages/svelte-imageway')],
      { timeout: 300000, maxBuffer: 1000000 },
    );
    const row = JSON.parse(stdout.trim()) as Row;
    expected ??= row.digest;
    if (row.digest !== expected) throw Error('Byte mismatch.');
    rows.push({ ...row, pair, variant });
    await writeFile(
      'bench/results/blurhash-display-3.1.3/stores.json',
      JSON.stringify(
        {
          complete: rows.length === 35,
          environment: env,
          corpus,
          reason:
            'Supplementary fairness check: original JS controls return Uint8ClampedArray like the reference; native returns owned Uint8Array. Add plain Uint8Array controls with otherwise identical cached-power/threshold algorithms to isolate store representation. Seven rotated/interleaved fresh-Node sets, same child protocol (25warmup batches,12000timed owned results, ASCII validation/copy and exact gamma fallback included for native). Product unchanged from release source13fec31. Retain primary studies; do not replace their results.',
          rows,
        },
        null,
        2,
      ) + '\n',
    );
    console.log(`${pair + 1}/7 ${variant}: ${row.perOperationMs.toFixed(6)} ms`);
  }
}
await writeFile(
  'bench/results/blurhash-display-3.1.3/stores-summary.json',
  JSON.stringify(
    variants.map((variant) => {
      const selected = rows.filter((r) => r.variant === variant);
      return {
        variant,
        perOperationMs: summary(selected.map((r) => r.perOperationMs)),
        firstBatchMs: summary(selected.map((r) => r.firstBatchMs)),
        initializationMs: summary(selected.map((r) => r.initializationMs)),
        peakRssBytes: summary(selected.map((r) => r.peakRssBytes)),
      };
    }),
    null,
    2,
  ) + '\n',
);

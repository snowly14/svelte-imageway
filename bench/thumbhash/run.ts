import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { execute, prepare, environment, summary, digest } from '../photographic/common.ts';

const baseline = resolve('.local/perf-3.2/baseline/package');
if (
  digest(await readFile('.local/perf-3.2/baseline.tgz')) !==
  '9c209ce1faef304334f7b71223f29801f5ebf50381244337a16ced2130828146'
)
  throw Error('Expected verified npm 3.1.0 archive.');
await prepare();
const directory = resolve('bench/results/patch-3.1.1');
await mkdir(directory, { recursive: true });
const env = await environment();
const rows: Array<{
  pair: number;
  scenario: string;
  variant: string;
  perOperationMs: number;
  peakRssBytes: number;
  initializationMs: number;
  firstBatchMs: number;
  digest: string;
}> = [];
for (const scenario of ['kernel', 'thumbhash', 'lqip']) {
  let expected: string | undefined;
  const variants =
    scenario === 'kernel' ? ['referenceJS', 'cachedJS', 'rust'] : ['before', 'after'];
  for (let pair = 0; pair < 7; pair++)
    for (const variant of pair % 2 ? [...variants].reverse() : variants) {
      const { stdout } = await execute(
        'node',
        [
          resolve('bench/thumbhash/child.ts'),
          scenario === 'kernel' ? variant : 'preview',
          variant === 'before' ? baseline : resolve('packages/svelte-imageway'),
          scenario,
        ],
        { timeout: 300000, maxBuffer: 1_000_000 },
      );
      const result = JSON.parse(stdout.trim()) as (typeof rows)[number];
      expected ??= result.digest;
      if (result.digest !== expected) throw Error(`Output mismatch: ${scenario}/${variant}`);
      rows.push({ ...result, pair, scenario, variant });
      await writeFile(
        join(directory, 'previews.json'),
        JSON.stringify(
          {
            environment: env,
            baseline: {
              version: '3.1.0',
              tarSha256: '9c209ce1faef304334f7b71223f29801f5ebf50381244337a16ced2130828146',
            },
            protocol:
              'Seven alternating fresh-Node pairs/sets, 24 pinned Kodak photos, source IO/decode excluded from kernel timer. Kernel: 25 warm-up batches, 500 timed batches =12000 calls including validation, host copies, quantization and owned output. Reference is thumbhash 0.1.1; cachedJS uses the same bounded scratch/cosines/arithmetic as Rust but needs no input FFI copy. Preview: initialization, first 24-photo batch, one warmup batch, 72 timed previews; complete preview JSON digest must match published 3.1.0. No preview-cache reuse. Suites serial; uncontrolled desktop. LQIP is an unchanged-path control, not an expected improvement.',
            rows,
          },
          null,
          2,
        ) + '\n',
      );
      console.log(`${scenario} ${pair + 1}/7 ${variant}: ${result.perOperationMs.toFixed(4)} ms`);
    }
}
await writeFile(
  join(directory, 'preview-summary.json'),
  JSON.stringify(
    [...new Set(rows.map((row) => row.scenario))].flatMap((scenario) =>
      [...new Set(rows.filter((row) => row.scenario === scenario).map((row) => row.variant))].map(
        (variant) => {
          const selected = rows.filter(
            (row) => row.scenario === scenario && row.variant === variant,
          );
          return {
            scenario,
            variant,
            perOperationMs: summary(selected.map((row) => row.perOperationMs)),
            initializationMs: summary(selected.map((row) => row.initializationMs)),
            firstBatchMs: summary(selected.map((row) => row.firstBatchMs)),
            peakRssBytes: summary(selected.map((row) => row.peakRssBytes)),
          };
        },
      ),
    ),
    null,
    2,
  ) + '\n',
);

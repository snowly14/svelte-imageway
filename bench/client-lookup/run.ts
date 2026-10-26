import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { digest, environment, execute, summary } from '../photographic/common.ts';
const output = 'bench/results/client-lookup-3.1.5/props.json';
try {
  await readFile(output);
  throw Error('Preserve existing results.');
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
}
if (
  digest(await readFile('.local/release-3.1.4/svelte-imageway-3.1.4.tgz')) !==
  '26385d08383d55d8d147a1dbc14d69b70ac6cd35946299efeeef2c63e9431cd6'
)
  throw Error('Unexpected baseline.');
const env = await environment();
const scenarios = ['relative', 'absolute', 'registered', 'mapped', 'empty-map'];
const rows: Array<{
  scenario: string;
  variant: string;
  round: number;
  perOperationMs: number;
  initializationMs: number;
  firstBatchMs: number;
  peakRssBytes: number;
  digest: string;
  registryBefore: boolean;
  registryAfter: boolean;
}> = [];
for (let round = 0; round < 7; round++) {
  const order = [
    ...scenarios.slice(round % scenarios.length),
    ...scenarios.slice(0, round % scenarios.length),
  ];
  if (round % 2) order.reverse();
  for (const scenario of order)
    for (const variant of round % 2 ? ['after', 'before'] : ['before', 'after']) {
      const { stdout } = await execute(
        'node',
        [
          resolve('bench/client-lookup/child.ts'),
          resolve(
            variant === 'before'
              ? '.local/client-3.1.5/baseline/package'
              : 'packages/svelte-imageway',
          ),
          scenario,
        ],
        { timeout: 300000, maxBuffer: 1000000 },
      );
      const row = JSON.parse(stdout.trim()) as (typeof rows)[number];
      const earlier = rows.find((r) => r.scenario === scenario);
      if (earlier && earlier.digest !== row.digest) throw Error('Attribute byte identity failed.');
      rows.push({ ...row, scenario, variant, round });
      await writeFile(
        output,
        JSON.stringify(
          {
            complete: rows.length === 70,
            environment: env,
            baseline: '3.1.4',
            protocol:
              'Seven rotated/reversed fresh-Node rounds, five scenarios, alternating variant order.24inputs prepared before timing, first batch and incremental import/preparation separate;100warm batches then10000batches/240000operations. Consume src/srcset/style lengths. Canonical complete attribute JSON must match across versions and rounds. Includes validation, registry/provider lookup, srcset, styles and owned return object. No browser rendering or image encode speed claim. All local suites serial; no OS cache flush.',
            rows,
          },
          null,
          2,
        ) + '\n',
      );
      console.log(
        `${round + 1}/7 ${scenario} ${variant}: ${(row.perOperationMs * 1000).toFixed(3)}us`,
      );
    }
}
await writeFile(
  'bench/results/client-lookup-3.1.5/props-summary.json',
  JSON.stringify(
    scenarios.flatMap((scenario) =>
      ['before', 'after'].map((variant) => {
        const selected = rows.filter((r) => r.scenario === scenario && r.variant === variant);
        return {
          scenario,
          variant,
          microseconds: summary(selected.map((r) => r.perOperationMs * 1000)),
          initializationMs: summary(selected.map((r) => r.initializationMs)),
          firstBatchMs: summary(selected.map((r) => r.firstBatchMs)),
          peakRssMiB: summary(selected.map((r) => r.peakRssBytes / 1048576)),
          registryBefore: selected[0]!.registryBefore,
          registryAfter: selected[0]!.registryAfter,
        };
      }),
    ),
    null,
    2,
  ) + '\n',
);

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execute, environment, summary } from '../photographic/common.ts';
const directory =
  process.argv.find((v) => v.startsWith('--output-dir='))?.slice('--output-dir='.length) ??
  'bench/results/component-props-3.1.8';
await mkdir(directory, { recursive: true });
try {
  await readFile(directory + '/attributes.json');
  throw Error('Preserve existing data');
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
}
const rows: Array<{
  scenario: string;
  variant: string;
  round: number;
  perOperationMs: number;
  digest: string;
  peakRssBytes: number;
}> = [];
if (
  (await import('../photographic/common.ts')).digest(
    await readFile('.local/component-3.1.8/baseline.tgz'),
  ) !== 'dd67a03d7c7a27dba607a838d1460117710e8a3fecca2ff0bf16cd89e60a2535'
)
  throw Error('Unexpected baseline archive');
const env = await environment();
for (const scenario of [
  'relative',
  'absolute',
  'empty-map',
  'registered',
  'mapped',
  'shorthand',
  'art',
])
  for (let round = 0; round < 7; round++)
    for (const variant of round % 2
      ? ['after', 'allocation', 'before']
      : ['before', 'allocation', 'after']) {
      const root = resolve(
        variant === 'before'
          ? '.local/component-3.1.8/baseline/package'
          : variant === 'allocation'
            ? '.local/component-3.1.8/allocation-control/package'
            : 'packages/svelte-imageway',
      );
      const { stdout } = await execute(
        'node',
        [resolve('bench/component-props/attributes-child.ts'), root, scenario],
        { timeout: 120000, maxBuffer: 1000000 },
      );
      const row = JSON.parse(stdout.trim()) as (typeof rows)[number];
      if (rows.some((r) => r.scenario === scenario && r.digest !== row.digest))
        throw Error('Attribute identity failed');
      rows.push({ ...row, variant, round });
      await writeFile(
        directory + '/attributes.json',
        JSON.stringify(
          {
            complete: rows.length === 147,
            environment: env,
            protocol:
              'Seven alternating/reversed fresh-Node triples;baseline vs allocation/style/size control vs selected;1000 warm batches then 240000 providerless / 24000 mapped full getImageProps calls per process,consume src/style/srcset,canonical attribute digest must match. No browser/render timing claim.',
            rows,
          },
          null,
          2,
        ) + '\n',
      );
    }
await writeFile(
  directory + '/attributes-summary.json',
  JSON.stringify(
    ['relative', 'absolute', 'empty-map', 'registered', 'mapped', 'shorthand', 'art'].map(
      (scenario) => ({
        scenario,
        ...Object.fromEntries(
          ['before', 'allocation', 'after'].map((variant) => [
            variant,
            summary(
              rows
                .filter((r) => r.scenario === scenario && r.variant === variant)
                .map((r) => r.perOperationMs * 1000),
            ),
          ]),
        ),
      }),
    ),
    null,
    2,
  ) + '\n',
);

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execute, environment, summary } from '../photographic/common.ts';
const directory =
  process.argv.find((v) => v.startsWith('--output-dir='))?.slice('--output-dir='.length) ??
  'bench/results/perf-3.1.9';
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
    await readFile('.local/release-3.1.8/svelte-imageway-3.1.8.tgz'),
  ) !== '7d4b09a7140a79204c4b4a77bf8fabecc81c8aecc7d16c09b016ce549efd9480'
)
  throw Error('Unexpected baseline archive');
const env = await environment();
const scenarios = process.argv.includes('--local-provider')
  ? ['local-provider']
  : ['relative', 'absolute', 'empty-map', 'registered', 'mapped', 'shorthand', 'art'];
for (const scenario of scenarios)
  for (let round = 0; round < 7; round++)
    for (const variant of round % 2 ? ['after', 'before'] : ['before', 'after']) {
      const root = resolve(
        variant === 'before'
          ? '.local/component-3.1.9/baseline/package'
          : '.local/component-3.1.9/candidate/package',
      );
      const { stdout } = await execute(
        'node',
        [resolve('bench/perf-3.1.9/attributes-child.ts'), root, scenario],
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
            complete: rows.length === scenarios.length * 14,
            environment: env,
            protocol:
              'Seven alternating fresh-Node pairs; verified npm 3.1.8 baseline versus frozen selected candidate;1000 warm batches then 240000 providerless / 24000 mapped/local-provider full getImageProps calls per process,consume src/style/srcset,canonical attribute digest must match. No browser/render timing claim.',
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
    scenarios.map((scenario) => ({
      scenario,
      ...Object.fromEntries(
        ['before', 'after'].map((variant) => [
          variant,
          summary(
            rows
              .filter((r) => r.scenario === scenario && r.variant === variant)
              .map((r) => r.perOperationMs * 1000),
          ),
        ]),
      ),
    })),
    null,
    2,
  ) + '\n',
);

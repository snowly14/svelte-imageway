import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execute, environment, summary } from '../photographic/common.ts';
const directory = 'bench/results/column-projection-3.1.7';
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
const env = await environment();
for (const scenario of ['relative', 'absolute', 'empty-map', 'registered', 'mapped'])
  for (let round = 0; round < 7; round++)
    for (const variant of round % 2 ? ['after', 'before'] : ['before', 'after']) {
      const root = resolve(
        variant === 'before'
          ? '.local/native-pack-3.1.7/baseline/package'
          : 'packages/svelte-imageway',
      );
      const { stdout } = await execute(
        'node',
        [resolve('bench/native-pack/attributes-child.ts'), root, scenario],
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
            complete: rows.length === 70,
            environment: env,
            protocol:
              'Seven alternating fresh-Node pairs;1000 warm batches then 240000 providerless / 24000 mapped full getImageProps calls per process,consume src/style/srcset,canonical attribute digest must match. No browser/render timing claim.',
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
    ['relative', 'absolute', 'empty-map', 'registered', 'mapped'].map((scenario) => ({
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

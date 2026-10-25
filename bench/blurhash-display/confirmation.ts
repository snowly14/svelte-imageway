import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execute, environment, summary, digest } from '../photographic/common.ts';
import { verifyCorpus } from '../lean-preview/corpus.ts';
const tarSha256 = 'f136df477dc8cc625caf0d9a39e39242a92c0cb7ee307a48956f89d7ed664644';
if (digest(await readFile('.local/rust-blurhash/baseline.tgz')) !== tarSha256)
  throw Error('Unexpected baseline.');
const corpus = await verifyCorpus(),
  env = await environment();
type Row = {
  pair: number;
  scenario: string;
  variant: string;
  perOperationMs: number;
  firstBatchMs: number;
  initializationMs: number;
  peakRssBytes: number;
  digest: string;
};
const rows: Row[] = [],
  expected = new Map<string, string>();
const cases = [
  ['blurhash', 'before'],
  ['blurhash', 'after'],
  ['lqip', 'before'],
  ['lqip', 'after'],
] as const;
for (let pair = 0; pair < 15; pair++)
  for (const [scenario, variant] of pair % 2 ? [...cases].reverse() : cases) {
    const { stdout } = await execute(
      'node',
      [
        resolve('bench/blurhash-display/child.ts'),
        'preview',
        resolve(
          variant === 'before'
            ? '.local/rust-blurhash/baseline/package'
            : 'packages/svelte-imageway',
        ),
        scenario,
      ],
      { timeout: 300000, maxBuffer: 1000000 },
    );
    const row = JSON.parse(stdout.trim()) as Row;
    expected.set(scenario, expected.get(scenario) ?? row.digest);
    if (row.digest !== expected.get(scenario)) throw Error('Preview identity mismatch.');
    rows.push({ ...row, pair, scenario, variant });
    await writeFile(
      'bench/results/blurhash-display-3.1.3/confirmation.json',
      JSON.stringify(
        {
          complete: rows.length === 60,
          environment: env,
          baseline: { version: '3.1.2', tarSha256 },
          corpus,
          reason:
            'Primary seven-set study showed a1.6% worse complete BlurHash median despite a faster isolated kernel, with overlapping ranges. Prespecified15additional fresh-process sets interleave BlurHash and unchanged LQIP cases, alternating their order; retain both studies, do not replace or pool away the initial regression. Same child protocol: first24-photo batch, one warmup,72timed sequential previews, no preview-cache reuse. Initialization excludes common static imports. All outputs match by complete JSON digest. Serial uncontrolled desktop.',
          rows,
        },
        null,
        2,
      ) + '\n',
    );
    console.log(`${pair + 1}/15 ${scenario} ${variant}: ${row.perOperationMs.toFixed(4)} ms`);
  }
await writeFile(
  'bench/results/blurhash-display-3.1.3/confirmation-summary.json',
  JSON.stringify(
    ['blurhash', 'lqip'].flatMap((scenario) =>
      ['before', 'after'].map((variant) => {
        const selected = rows.filter((r) => r.scenario === scenario && r.variant === variant);
        return {
          scenario,
          variant,
          perOperationMs: summary(selected.map((r) => r.perOperationMs)),
          firstBatchMs: summary(selected.map((r) => r.firstBatchMs)),
          initializationMs: summary(selected.map((r) => r.initializationMs)),
          peakRssBytes: summary(selected.map((r) => r.peakRssBytes)),
        };
      }),
    ),
    null,
    2,
  ) + '\n',
);

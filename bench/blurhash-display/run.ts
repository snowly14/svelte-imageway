import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { execute, environment, summary, digest } from '../photographic/common.ts';
import { verifyCorpus } from '../lean-preview/corpus.ts';
const baseline = resolve('.local/rust-blurhash/baseline/package'),
  tarSha256 = 'f136df477dc8cc625caf0d9a39e39242a92c0cb7ee307a48956f89d7ed664644';
if (digest(await readFile('.local/rust-blurhash/baseline.tgz')) !== tarSha256)
  throw Error('Expected verified npm3.1.2 archive.');
const corpus = await verifyCorpus(),
  env = await environment();
const directory = resolve('bench/results/blurhash-display-3.1.3');
await mkdir(directory, { recursive: true });
type Row = {
  scenario: string;
  variant: string;
  pair: number;
  perOperationMs: number;
  initializationMs: number;
  firstBatchMs: number;
  peakRssBytes: number;
  digest: string;
};
const rows: Row[] = [];
for (const [scenario, variants] of [
  ['kernel', ['referenceJS', 'cachedJS', 'thresholdJS', 'rust']],
  ['blurhash', ['before', 'after']],
  ['lqip', ['before', 'after']],
  ['thumbhash', ['before', 'after']],
] as const) {
  let expected: string | undefined;
  for (let pair = 0; pair < 7; pair++)
    for (const variant of pair % 2 ? [...variants].reverse() : variants) {
      const { stdout } = await execute(
        'node',
        [
          resolve('bench/blurhash-display/child.ts'),
          scenario === 'kernel' ? variant : 'preview',
          variant === 'before' ? baseline : resolve('packages/svelte-imageway'),
          scenario,
        ],
        { timeout: 300000, maxBuffer: 1000000 },
      );
      const row = JSON.parse(stdout.trim()) as Row;
      expected ??= row.digest;
      if (row.digest !== expected) throw Error(`Byte mismatch: ${scenario}/${variant}`);
      rows.push({ ...row, scenario, variant, pair });
      await writeFile(
        join(directory, 'previews.json'),
        JSON.stringify(
          {
            complete: rows.length === 70,
            environment: env,
            baseline: { version: '3.1.2', tarSha256 },
            corpus,
            protocol:
              'Seven alternating fresh-Node sets; 24 pinned Kodak photos. Kernel: prepared hashes/source decoding excluded; 25 warmup batches then 500 timed batches=12000 owned 16x16 RGBA results, consumed by checksum. Reference blurhash2.0.5; cachedJS caches base83/cosine/sRGB/coefficients but uses reference power gamma; thresholdJS additionally uses same 2048-bin gamma hint/255 thresholds/conservative 1e-7 boundary fallback as Rust. Rust includes ASCII copy/validation, exact boundary fallback and owned pixel copy. Incremental initialization excludes common imports; native gamma tables initialize lazily in first batch, JS controls initialize during factory setup. Complete previews: no preview-cache reuse, first24-photo batch, one warmup,72timed sequential operations; complete JSON digest must match. LQIP/ThumbHash unchanged controls. All suites serial on uncontrolled desktop.',
            rows,
          },
          null,
          2,
        ) + '\n',
      );
      console.log(`${scenario} ${pair + 1}/7 ${variant}: ${row.perOperationMs.toFixed(6)} ms`);
    }
}
await writeFile(
  join(directory, 'summary.json'),
  JSON.stringify(
    [...new Set(rows.map((r) => r.scenario))].flatMap((scenario) =>
      [...new Set(rows.filter((r) => r.scenario === scenario).map((r) => r.variant))].map(
        (variant) => {
          const selected = rows.filter((r) => r.scenario === scenario && r.variant === variant);
          return {
            scenario,
            variant,
            perOperationMs: summary(selected.map((r) => r.perOperationMs)),
            initializationMs: summary(selected.map((r) => r.initializationMs)),
            firstBatchMs: summary(selected.map((r) => r.firstBatchMs)),
            peakRssBytes: summary(selected.map((r) => r.peakRssBytes)),
          };
        },
      ),
    ),
    null,
    2,
  ) + '\n',
);

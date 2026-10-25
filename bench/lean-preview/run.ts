import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { execute, environment, summary, digest } from '../photographic/common.ts';
const baseline = resolve('.local/lean-3.2/baseline/package');
const tarSha256 = 'ecfff55255330f5722912f3d3c122e58b5fe4beafcaafe1cf78f0c03f92d76d7';
if (digest(await readFile('.local/lean-3.2/baseline.tgz')) !== tarSha256)
  throw Error('Expected verified npm 3.1.1 archive.');
const directory = resolve('bench/results/lean-preview-3.1.2');
await mkdir(directory, { recursive: true });
const env = await environment();
const rows: Array<{
  pair: number;
  scenario: string;
  variant: string;
  initializationMs: number;
  firstBatchMs: number;
  perOperationMs: number;
  digest: string;
  peakRssBytes: number;
}> = [];
for (const [scenario, variants] of [
  ['decode', ['referenceJS', 'cachedJS', 'rust']],
  ['png', ['referencePNG', 'cachedPNG', 'rustPNG']],
  ['thumbhash', ['before', 'after']],
  ['lqip', ['before', 'after']],
  ['props', ['before', 'after']],
] as const) {
  let expected: string | undefined;
  for (let pair = 0; pair < 7; pair++)
    for (const variant of pair % 2 ? [...variants].reverse() : variants) {
      const { stdout } = await execute(
        'node',
        [
          resolve('bench/lean-preview/child.ts'),
          scenario === 'decode' || scenario === 'png'
            ? variant
            : scenario === 'props'
              ? 'props'
              : 'preview',
          variant === 'before' ? baseline : resolve('packages/svelte-imageway'),
          scenario,
        ],
        { timeout: 300000, maxBuffer: 1000000 },
      );
      const result = JSON.parse(stdout.trim()) as (typeof rows)[number];
      expected ??= result.digest;
      if (result.digest !== expected) throw Error(`Byte mismatch in ${scenario}/${variant}`);
      rows.push({ ...result, pair, scenario, variant });
      await writeFile(
        join(directory, 'previews.json'),
        JSON.stringify(
          {
            complete: rows.length === 84,
            environment: env,
            baseline: { version: '3.1.1', tarSha256 },
            protocol:
              'Seven alternating fresh-Node sets; 24 pinned Kodak photographs. Kernel setup decodes outside timer; 25 warmup batches then 200 timed batches = 4800 calls. All variants consume output via base64/checksum. Rust includes validation, hash copy, owned RGBA output for decode or synchronous PNG base64. cachedJS reuses bounded cosine/coefficient scratch; cachedPNG adds fixed typed-array PNG/CRC/base64 control. Initialization is incremental after common static imports, not whole-process startup. Complete previews: first 24-image batch, one warmup batch, 72 timed sequential previews, no persistent preview cache. LQIP unchanged control. Props: 24 registered URL artifacts, 100 warmup batches then 10000 batches (240000 calls), empty provider map; canonical attribute digest must match. All output digests must match. Serial suites on uncontrolled desktop.',
            rows,
          },
          null,
          2,
        ) + '\n',
      );
      console.log(`${scenario} ${pair + 1}/7 ${variant} ${result.perOperationMs.toFixed(4)} ms`);
    }
}
await writeFile(
  join(directory, 'summary.json'),
  JSON.stringify(
    [...new Set(rows.map((row) => row.scenario))].flatMap((scenario) =>
      [...new Set(rows.filter((row) => row.scenario === scenario).map((row) => row.variant))].map(
        (variant) => {
          const selection = rows.filter(
            (row) => row.scenario === scenario && row.variant === variant,
          );
          return {
            scenario,
            variant,
            perOperationMs: summary(selection.map((row) => row.perOperationMs)),
            initializationMs: summary(selection.map((row) => row.initializationMs)),
            firstBatchMs: summary(selection.map((row) => row.firstBatchMs)),
            peakRssBytes: summary(selection.map((row) => row.peakRssBytes)),
          };
        },
      ),
    ),
    null,
    2,
  ) + '\n',
);

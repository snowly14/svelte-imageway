import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { environment, execute, digest, summary } from '../photographic/common.ts';
import { verifyCorpus } from '../lean-preview/corpus.ts';
const directory =
  process.argv.find((v) => v.startsWith('--output-dir='))?.slice('--output-dir='.length) ??
  'bench/results/sparse-colour-3.1.8';
await mkdir(directory, { recursive: true });
await mkdir(directory, { recursive: true });
try {
  await readFile(directory + '/native.json');
  throw Error('Preserve existing data');
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
}
if (
  digest(await readFile('.local/component-3.1.8/baseline.tgz')) !==
  'dd67a03d7c7a27dba607a838d1460117710e8a3fecca2ff0bf16cd89e60a2535'
)
  throw Error('Unexpected baseline');
const inputs = await verifyCorpus(),
  env = await environment(),
  roots: Record<string, string> = {
    before: '.local/component-3.1.8/baseline/package',
    js: '.local/sparse-colour/js-control/package',
    after: 'packages/svelte-imageway',
  };
const modes = [
  'colour',
  'png',
  'display',
  'preview:color',
  'preview:lqip',
  'preview:thumbhash',
  'preview:blurhash',
];
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
for (const mode of modes)
  for (let round = 0; round < 7; round++) {
    const variants = ['before', 'js', 'after'],
      order = [...variants.slice(round % 3), ...variants.slice(0, round % 3)];
    if (round % 2) order.reverse();
    for (const variant of order) {
      const { stdout } = await execute(
        'node',
        [resolve('bench/sparse-colour/child.ts'), resolve(roots[variant]!), mode, variant],
        { timeout: 300000, maxBuffer: 1000000 },
      );
      const row = JSON.parse(stdout.trim()) as (typeof rows)[number];
      if (rows.some((r) => r.mode === mode && r.digest !== row.digest))
        throw Error('Preview/hash/PNG identity failed');
      rows.push({ ...row, mode, variant, round });
      await writeFile(
        directory + '/native.json',
        JSON.stringify(
          {
            complete: rows.length === 147,
            environment: env,
            inputs,
            protocol:
              'Seven rotated/reversed fresh-Node triples. All24pinned photos; Sharp RGBA decode<=32outside timed kernels. Colour:100warm batches then48000calls including validation/copy/FFI/string output. PNG:12000calls with validation/input copy/native checksum/base64 vs cached JS PNG using per-row modulus. Display:12000complete ThumbHash decode+PNG dataURL calls;JS control uses baseline native decode and owned subarray view without extra RGBA copy. Full previews:24first+24warm,72timed sequential completeSharp+math+output;allfullJSONandPNGdigests identical. JS colour uses sparse bin reset and LUT exact quantization, zero input copy; native fixed memory/current host copy. Init/first separately. Serial active desktop; no codec/build/HTTP claim follows from kernel timing.',
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
  directory + '/native-summary.json',
  JSON.stringify(
    modes.flatMap((mode) =>
      ['before', 'js', 'after'].map((variant) => {
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

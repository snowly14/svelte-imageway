import { resolve } from 'node:path';
import { execute, environment, save, summary } from './common.ts';

export async function nativeBench() {
  const env = await environment();
  const rows: Array<{
    mode: string;
    round: number;
    initializationMs: number;
    firstBatchMs: number;
    batches: number;
    operations: number;
    perPhotoMs: number;
    checksum: number;
    outputDigest: string;
    node: string;
  }> = [];
  const modes = ['kernel-js', 'kernel-rust', 'pipeline-js', 'pipeline-rust'];
  for (let round = 0; round < 7; round++)
    for (const mode of round % 2 ? [...modes].reverse() : modes) {
      const { stdout } = await execute(
        'node',
        [resolve('bench/photographic/native-child.ts'), mode],
        { timeout: 120000 },
      );
      const row = JSON.parse(stdout.trim()) as (typeof rows)[number];
      const prefix = mode.split('-')[0]!;
      if (
        rows.some(
          (other) => other.mode.startsWith(prefix) && other.outputDigest !== row.outputDigest,
        )
      )
        throw Error('Native/control output digests differ.');
      rows.push({ ...row, round });
      await save('native', {
        environment: env,
        protocol:
          'Seven alternating fresh-Node rounds, all 24 Kodak photos per batch. Cached-lookup optimized JS control versus actual bundled Rust/WASM encoder, including host validation/copies and string packing. Raw 32px RGBA inputs prepared outside kernel timer; 25 warmup batches then 500 timed batches. Full BlurHash preview mirrors shipped decode32/stats/hash/decode16/WebP20 pipeline, validates Rust outputs against actual package placeholder(), one warmup batch then three timed batches. Source files read outside timer, decode remains inside pipeline timer. Initialization and first 24-photo batch are separate; kernel and pipeline digests must match between JS/Rust. Default LQIP and JPEG/WebP/AVIF encoding are unaffected by this kernel.',
        rows,
      });
      console.log(`native ${round + 1}/7 ${mode}: ${(row.perPhotoMs * 1000).toFixed(1)}us/photo`);
    }
  const summaries = modes.map((mode) => ({
    mode,
    perPhotoMs: summary(rows.filter((r) => r.mode === mode).map((r) => r.perPhotoMs)),
    initializationMs: summary(rows.filter((r) => r.mode === mode).map((r) => r.initializationMs)),
    firstBatchMs: summary(rows.filter((r) => r.mode === mode).map((r) => r.firstBatchMs)),
  }));
  await save('native-summary', summaries);
  return summaries;
}

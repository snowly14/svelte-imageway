import { createHash } from 'node:crypto';
import { cpus, totalmem, release } from 'node:os';
import { performance } from 'node:perf_hooks';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { sniff } from '../packages/svelte-imageway/dist/node/pipeline.js';
import { ImagewayError } from '../packages/svelte-imageway/dist/core/errors.js';
const controlPath = resolve('.local/component-3.1.9/approved/package/dist/node/pipeline.js');
const control = (await import(pathToFileURL(controlPath).href)).sniff as typeof sniff;
const inputs = {
  jpeg: Buffer.from([255, 216, 255]),
  png: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  gif: Buffer.from('GIF89a'),
  webp: Buffer.from('RIFF0000WEBP'),
  heif: Buffer.from('0000ftypavif00000000'),
  tiffLE: Buffer.from([73, 73, 42, 0]),
  tiffBE: Buffer.from([77, 77, 0, 42]),
  jxl: Buffer.from([255, 10]),
  jxlContainer: Buffer.from('0000000c4a584c200d0a870a', 'hex'),
  svg: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
};
const outcome = (fn: typeof sniff, bytes: Uint8Array) => {
  try {
    return fn(bytes);
  } catch (error) {
    // Different module instances own different constructors.
    return (error as ImagewayError).code;
  }
};
let checked = 0;
for (const bytes of Object.values(inputs)) {
  for (let n = 0; n <= bytes.length; n++) {
    const padded = Buffer.concat([Buffer.from([0, 0]), bytes.subarray(0, n), Buffer.from([0])]);
    const view = padded.subarray(2, 2 + n);
    assert.equal(outcome(sniff, view), outcome(control, view));
    checked++;
  }
}
let state = 1;
for (let i = 0; i < 4096; i++) {
  const bytes = Uint8Array.from({ length: i % 64 }, () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state >>> 24;
  });
  assert.equal(outcome(sniff, bytes), outcome(control, bytes));
  checked++;
}
const iterations = 30000;
const rows: Array<{ kind: string; round: number; variant: string; nsPerCall: number }> = [];
for (const [kind, bytes] of Object.entries(inputs)) {
  for (const fn of [control, sniff]) for (let i = 0; i < 5000; i++) fn(bytes);
  for (let round = 0; round < 7; round++) {
    const variants = round % 2 ? ['candidate', 'control'] : ['control', 'candidate'];
    for (const variant of variants) {
      const fn = variant === 'control' ? control : sniff;
      let value = '';
      const start = performance.now();
      for (let i = 0; i < iterations; i++) value = fn(bytes);
      const nsPerCall = ((performance.now() - start) * 1e6) / iterations;
      assert.equal(value, control(bytes));
      rows.push({ kind, round, variant, nsPerCall });
    }
  }
}
const median = (values: number[]) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)]!;
const summary = Object.keys(inputs).map((kind) => ({
  kind,
  ...Object.fromEntries(
    ['control', 'candidate'].map((variant) => [
      variant,
      median(rows.filter((r) => r.kind === kind && r.variant === variant).map((r) => r.nsPerCall)),
    ]),
  ),
}));
const output = resolve(
  process.argv.find((arg) => arg.startsWith('--output='))?.slice('--output='.length) ??
    'bench/results/signature-sniff-2026-11-01.json',
);
await mkdir(resolve('bench/results'), { recursive: true });
try {
  await readFile(output);
  throw Error('Preserve existing results.');
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}
await writeFile(
  output,
  JSON.stringify(
    {
      node: process.version,
      cpu: cpus()[0]?.model,
      logicalCpus: cpus().length,
      memoryBytes: totalmem(),
      osRelease: release(),
      sourceSha256: {
        control: createHash('sha256')
          .update(await readFile(controlPath))
          .digest('hex'),
        candidate: createHash('sha256')
          .update(await readFile(resolve('packages/svelte-imageway/dist/node/pipeline.js')))
          .digest('hex'),
      },
      arch: process.arch,
      platform: process.platform,
      protocol:
        'Seven alternating within-process pairs per signature, 30000 calls after 5000-call warmup per implementation. Synthetic signatures only; not encode/build or real-file throughput. Current compiled implementation versus frozen shipped 3.1.9.',
      checked,
      rows,
      summary,
    },
    null,
    2,
  ) + '\n',
);
console.log(JSON.stringify(summary, null, 2));

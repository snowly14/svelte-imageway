import { createHash } from 'node:crypto';
import { cpus, totalmem } from 'node:os';
import { execFileSync } from 'node:child_process';
import { createPNGBytesControl } from './controls/png-crc-js.ts';
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
const setupIncludingArtifactLoadingMs = {};
const load = async (name) => {
  const started = performance.now();
  const bytes =
    name === 'control'
      ? execFileSync('git', ['show', '5a74794:packages/svelte-imageway/src/lib/node/blurhash.wasm'])
      : await readFile('packages/svelte-imageway/src/lib/node/blurhash.wasm');
  const { instance } = await WebAssembly.instantiate(bytes);
  const e = instance.exports;
  assert.equal(e.memory.buffer.byteLength, 65536);
  assert.throws(() => e.memory.grow(1));
  setupIncludingArtifactLoadingMs[name] = performance.now() - started;
  return (pixels, w, h) => {
    if (
      !Number.isInteger(w) ||
      !Number.isInteger(h) ||
      w < 1 ||
      h < 1 ||
      w > 32 ||
      h > 32 ||
      pixels.length !== w * h * 4
    )
      throw Error('Invalid bounded PNG.');
    new Uint8Array(e.memory.buffer, e.pixels_ptr(), pixels.length).set(pixels);
    const length = e.rgba_png(w, h);
    return new Uint8Array(e.memory.buffer, e.png_ptr(), length).slice();
  };
};
const control = await load('control'),
  candidate = await load('candidate');
const jsStarted = performance.now();
const js = createPNGBytesControl();
setupIncludingArtifactLoadingMs.optimizedJS = performance.now() - jsStarted;
const optimizedJS = (pixels, w, h) => js(w, h, pixels);
let state = 1;
for (let w = 1; w <= 32; w++)
  for (let h = 1; h <= 32; h++) {
    for (const mode of ['white', 'random']) {
      const pixels = Uint8Array.from({ length: w * h * 4 }, () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return mode === 'white' ? 255 : state >>> 24;
      });
      assert.deepEqual(candidate(pixels, w, h), control(pixels, w, h));
      assert.deepEqual(optimizedJS(pixels, w, h), control(pixels, w, h));
    }
  }
const rows = [];
for (const size of [8, 16, 32]) {
  const pixels = Uint8Array.from({ length: size * size * 4 }, (_, i) => i % 256);
  for (const fn of [control, candidate, optimizedJS])
    for (let i = 0; i < 3000; i++) fn(pixels, size, size);
  for (let round = 0; round < 7; round++)
    for (const variant of round % 2
      ? ['candidate', 'optimizedJS', 'control']
      : ['control', 'optimizedJS', 'candidate']) {
      const fn =
        variant === 'control' ? control : variant === 'candidate' ? candidate : optimizedJS;
      let result;
      const start = performance.now();
      for (let i = 0; i < 15000; i++) result = fn(pixels, size, size);
      const ns = ((performance.now() - start) * 1e6) / 15000;
      assert.deepEqual(result, control(pixels, size, size));
      rows.push({ size, round, variant, ns });
    }
}
const median = (a) => a.sort((a, b) => a - b)[3];
const summary = [8, 16, 32].map((size) => ({
  size,
  control: median(rows.filter((r) => r.size === size && r.variant === 'control').map((r) => r.ns)),
  candidate: median(
    rows.filter((r) => r.size === size && r.variant === 'candidate').map((r) => r.ns),
  ),
}));
await writeFile(
  process.argv.find((arg) => arg.startsWith('--output='))?.slice('--output='.length) ??
    'bench/results/native-png-crc-2026-11-01.json',
  JSON.stringify(
    {
      node: process.version,
      cpu: cpus()[0]?.model,
      memoryBytes: totalmem(),
      setupIncludingArtifactLoadingMs,
      wasmSha256: createHash('sha256')
        .update(await readFile('packages/svelte-imageway/src/lib/node/blurhash.wasm'))
        .digest('hex'),
      parityCases: 2048,
      protocol:
        'All dimensions 1..32 each white/random byte parity. Seven alternating within-process pairs, 15000 calls after 3000 warmups, including input copy and owned output copy. Fixed 64KiB WASM.',
      rows,
      summary,
    },
    null,
    2,
  ) + '\n',
  { flag: 'wx' },
);
console.log(summary);

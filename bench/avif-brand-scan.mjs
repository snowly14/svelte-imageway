import { writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import assert from 'node:assert/strict';
const control = (await import('./controls/avif-raster.ts')).rasterFrames;
const candidate = (await import('../packages/svelte-imageway/dist/core/raster.js')).rasterFrames;
const rows = [];
for (const size of [32, 4096, 65536]) {
  const bytes = Buffer.alloc(size);
  bytes.writeUInt32BE(size);
  bytes.write('ftypavif', 4);
  for (const fn of [control, candidate]) for (let i = 0; i < 100; i++) assert.equal(fn(bytes), 1);
  const iterations = Math.max(100, Math.floor(2000000 / size));
  for (let round = 0; round < 7; round++)
    for (const variant of round % 2 ? ['candidate', 'control'] : ['control', 'candidate']) {
      const fn = variant === 'control' ? control : candidate;
      const t = performance.now();
      for (let i = 0; i < iterations; i++) assert.equal(fn(bytes), 1);
      rows.push({
        size,
        round,
        variant,
        iterations,
        nsPerCall: ((performance.now() - t) * 1e6) / iterations,
      });
    }
  bytes.write('avis', size - 4);
  for (const fn of [control, candidate]) assert.throws(() => fn(bytes), /sequences/);
}
await writeFile(
  'bench/results/avif-brand-scan-2026-11-01.json',
  JSON.stringify(
    {
      node: process.version,
      protocol:
        'Seven alternating in-process pairs, synthetic declared file-type boxes. Both functions include boundary checks. No decode or overall build claim. Control from acb9370, assert cost included.',
      rows,
    },
    null,
    2,
  ) + '\n',
  { flag: 'wx' },
);
for (const size of [32, 4096, 65536])
  for (const variant of ['control', 'candidate']) {
    const a = rows
      .filter((r) => r.size === size && r.variant === variant)
      .map((r) => r.nsPerCall)
      .sort((a, b) => a - b);
    console.log(size, variant, a[3]);
  }

import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { encode } from 'blurhash';
import sharp from 'sharp';
import { optimizedJS } from './preview-js.ts';
const mode = process.argv[2]!,
  fixture = process.argv[3]!;
const start = performance.now();
let width = 32;
const height = fixture === 'square' ? 32 : fixture === 'tiny' ? 8 : 21;
if (fixture === 'tiny') width = 12;
let state = 17;
const pixels = Uint8Array.from({ length: width * height * 4 }, () => {
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  return state >>> 24;
});
const clamped = new Uint8ClampedArray(pixels.buffer);
let run: () => string | Promise<string>;
if (mode === 'reference') run = () => encode(clamped, width, height, 4, 3);
else if (mode === 'optimizedJS') {
  const fn = optimizedJS();
  run = () => fn(pixels, width, height);
} else if (mode === 'rust') {
  const { getBlurhashEncoder } = await import('../packages/svelte-imageway/dist/node/blurhash.js');
  const encoder = await getBlurhashEncoder();
  run = () => encoder.encode(pixels, width, height);
} else {
  const module =
    mode === 'pipeline-baseline'
      ? process.argv[4]!
      : 'packages/svelte-imageway/dist/vite/placeholder.js';
  const { placeholder } = await import(pathToFileURL(resolve(module)).href);
  const source =
    fixture === 'landscape'
      ? await readFile('examples/components/src/landscape.png')
      : await sharp(pixels, { raw: { width, height, channels: 4 } })
          .png()
          .toBuffer();
  run = async () => JSON.stringify(await placeholder(source, 'blurhash'));
}
const initializedMs = performance.now() - start;
const firstBegin = performance.now();
const first = await run();
const firstOperationMs = performance.now() - firstBegin;
for (let i = 0; i < 25; i++) await run();
const count = mode.startsWith('pipeline') ? 30 : 2000;
let checksum = 0;
const begin = performance.now();
for (let i = 0; i < count; i++) {
  const result = await run();
  checksum += result.charCodeAt(i % result.length);
}
const elapsed = performance.now() - begin;
console.log(
  JSON.stringify({
    mode,
    fixture,
    initializedMs,
    firstOperationMs,
    count,
    perOperationMs: elapsed / count,
    checksum,
    digest: createHash('sha256').update(first).digest('hex'),
  }),
);

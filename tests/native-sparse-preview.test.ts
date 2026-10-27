import { expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { getBlurhashEncoder } from '../packages/svelte-imageway/src/lib/node/blurhash.js';
import { createHistogramControl } from '../bench/improvements/histogram.js';
import { createSparseColourControl } from '../bench/sparse-colour/control.js';
import { rgbaToDataURL } from 'thumbhash';

it('preserves every byte quantization boundary and clears sparse bins after ties and full capacity', async () => {
  const kernel = await getBlurhashEncoder(),
    reference = createHistogramControl(),
    js = createSparseColourControl();
  for (let value = 0; value < 256; value++) {
    const pixels = Uint8Array.from([value, 17, 241, value]);
    const expected =
      '#' +
      (((Math.floor((value * 16) / 257) * 16 + 8) << 16) | (24 << 8) | 248)
        .toString(16)
        .padStart(6, '0');
    expect(kernel.dominantColor(pixels, 1, 1)).toBe(expected);
    expect(js(pixels, 1, 1)).toBe(expected);
  }
  const distinct = new Uint8Array(4096);
  for (let i = 0; i < 1024; i++)
    distinct.set([(i >> 8) * 16 + 8, ((i >> 4) & 15) * 16 + 8, (i & 15) * 16 + 8, i & 255], i * 4);
  expect(kernel.dominantColor(distinct, 32, 32)).toBeUndefined();
  expect(js(distinct, 32, 32)).toBeUndefined();
  let state = 3;
  for (let seed = 0; seed < 512; seed++) {
    const width = (seed % 32) + 1,
      height = ((seed * 13) % 32) + 1;
    const pixels = Uint8Array.from({ length: width * height * 4 }, () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state >>> 24;
    });
    if (seed % 3 === 0)
      for (let i = 0; i < pixels.length; i += 4) pixels.set([128, 64, 32, seed & 255], i);
    const snapshot = pixels.slice(),
      expected = reference(pixels, width, height);
    expect(kernel.dominantColor(pixels, width, height)).toBe(expected);
    expect(js(pixels, width, height)).toBe(expected);
    expect(pixels).toEqual(snapshot);
    // Ambiguous and invalid calls must not poison the next singleton result.
    kernel.dominantColor(distinct, 32, 32);
    expect(() => kernel.dominantColor(pixels, 33, height)).toThrow();
    expect(kernel.dominantColor(Uint8Array.from([255, 255, 255, 0]), 1, 1)).toBe('#f8f8f8');
  }
});

it('keeps row-deferred Adler-32/CRC PNG bytes exact at dimension and carry extremes', async () => {
  const { instance } = await WebAssembly.instantiate(
    await readFile(
      new URL('../packages/svelte-imageway/src/lib/node/blurhash.wasm', import.meta.url),
    ),
  );
  const k = instance.exports as unknown as {
    memory: WebAssembly.Memory;
    pixels_ptr(): number;
    png_ptr(): number;
    rgba_png(w: number, h: number): number;
  };
  const pixels = new Uint8Array(k.memory.buffer, k.pixels_ptr(), 4096),
    png = new Uint8Array(k.memory.buffer, k.png_ptr(), 4400);
  let state = 1;
  for (const [w, h] of [
    [1, 1],
    [1, 32],
    [32, 1],
    [32, 32],
    [7, 13],
    [16, 16],
  ])
    for (const mode of ['zero', 'white', 'random']) {
      const input = Uint8Array.from({ length: w! * h! * 4 }, () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return mode === 'zero' ? 0 : mode === 'white' ? 255 : state >>> 24;
      });
      pixels.set(input);
      const length = k.rgba_png(w!, h!);
      expect(length).toBeGreaterThan(0);
      expect(length).toBeLessThanOrEqual(4400);
      const actual =
        'data:image/png;base64,' + Buffer.from(png.subarray(0, length)).toString('base64');
      expect(actual).toBe(rgbaToDataURL(w!, h!, input));
    }
  png.fill(123);
  const previous = png.slice();
  for (const [w, h] of [
    [0, 1],
    [1, 0],
    [33, 1],
    [1, 33],
    [0xffffffff, 1],
  ]) {
    expect(k.rgba_png(w!, h!)).toBe(0);
    expect(png).toEqual(previous);
  }
  expect(k.memory.buffer.byteLength).toBe(65536);
  expect(() => k.memory.grow(1)).toThrow();
});

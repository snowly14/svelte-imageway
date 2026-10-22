import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { encode, decode } from 'blurhash';
import {
  createBlurhashEncoder,
  getBlurhashEncoder,
} from '../packages/svelte-imageway/src/lib/node/blurhash.js';
import { placeholder } from '../packages/svelte-imageway/src/lib/vite/placeholder.js';
import sharp from 'sharp';
const url = new URL('../packages/svelte-imageway/src/lib/node/blurhash.wasm', import.meta.url);
function fixture(width: number, height: number, seed: number): Uint8Array {
  let state = seed;
  return Uint8Array.from({ length: width * height * 4 }, () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state >>> 24;
  });
}
describe('bounded Rust BlurHash kernel', () => {
  it('matches libvips dominant colour for unique maxima and defers ambiguous ties', async () => {
    const encoder = await getBlurhashEncoder();
    let unique = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const width = (seed % 32) + 1;
      const height = ((seed * 7) % 32) + 1;
      const pixels = fixture(width, height, seed);
      const snapshot = pixels.slice();
      const actual = encoder.dominantColor(pixels, width, height);
      if (actual) {
        const { r, g, b } = (await sharp(pixels, { raw: { width, height, channels: 4 } }).stats())
          .dominant;
        expect(actual).toBe(`#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`);
        unique++;
      }
      expect(pixels).toEqual(snapshot);
    }
    expect(unique).toBeGreaterThan(10);
    expect(encoder.dominantColor(Uint8Array.of(255, 0, 0, 0), 1, 1)).toBe('#f80808');
    expect(
      encoder.dominantColor(Uint8Array.of(255, 0, 0, 255, 0, 255, 0, 255), 2, 1),
    ).toBeUndefined();
    expect(encoder.dominantColor(Uint8Array.of(0, 0, 255, 255), 1, 1)).toBe('#0808f8');
    expect(() => encoder.dominantColor(new Uint8Array(4), 33, 1)).toThrow();
    expect(() => encoder.dominantColor(new Uint8Array(3), 1, 1)).toThrow();
  });
  it('matches reference hashes and decoded pixels across sizes, alpha and seeded inputs', async () => {
    const encoder = await getBlurhashEncoder();
    for (let seed = 1; seed <= 80; seed++) {
      const width = (seed % 32) + 1,
        height = ((seed * 7) % 32) + 1;
      const pixels = fixture(width, height, seed);
      const expected = encode(new Uint8ClampedArray(pixels), width, height, 4, 3);
      const actual = encoder.encode(pixels, width, height);
      expect(actual).toBe(expected);
      expect(decode(actual, 16, 16)).toEqual(decode(expected, 16, 16));
    }
    for (const value of [0, 127, 255]) {
      const pixels = new Uint8Array(32 * 32 * 4).fill(value);
      expect(encoder.encode(pixels, 32, 32)).toBe(
        encode(new Uint8ClampedArray(pixels), 32, 32, 4, 3),
      );
    }
  });
  it('rejects malformed dimensions before memory writes and preserves caller buffers', async () => {
    const encoder = await getBlurhashEncoder();
    for (const [w, h] of [
      [0, 1],
      [33, 1],
      [1, 33],
      [-1, 1],
      [1.5, 2],
      [NaN, 1],
      [Infinity, 1],
    ])
      expect(() => encoder.encode(new Uint8Array(4), w!, h!)).toThrow(/dimensions/);
    expect(() => encoder.encode(new Uint8Array(3), 1, 1)).toThrow(/RGBA/);
    const pixels = fixture(32, 21, 17),
      owned = pixels.slice();
    const hash = encoder.encode(pixels, 32, 21);
    expect(pixels).toEqual(owned);
    encoder.encode(fixture(3, 2, 71), 3, 2);
    expect(encoder.encode(pixels, 32, 21)).toBe(hash);
  });
  it('has no host imports, fixed 64 KiB memory and rejects invalid native calls', async () => {
    const bytes = await readFile(url);
    const module = await WebAssembly.compile(bytes);
    expect(WebAssembly.Module.imports(module)).toEqual([]);
    const instance = await WebAssembly.instantiate(module);
    const memory = instance.exports.memory as WebAssembly.Memory;
    expect(memory.buffer.byteLength).toBe(65536);
    expect(() => memory.grow(1)).toThrow();
    const run = instance.exports.coefficients as (w: number, h: number) => number;
    for (const [w, h] of [
      [0, 32],
      [33, 32],
      [32, 33],
      [0xffffffff, 1],
    ])
      expect(run(w!, h!)).toBe(0);
    await expect(createBlurhashEncoder(new Uint8Array([0, 1, 2]))).rejects.toThrow();
  });
  it('uses the packaged kernel for a real build preview with the reference hash', async () => {
    const source = await sharp({
      create: { width: 64, height: 42, channels: 3, background: 'orange' },
    })
      .png()
      .toBuffer();
    const { data: pixels, info } = await sharp(source)
      .autoOrient()
      .resize({ width: 32, height: 32, fit: 'inside', withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const expected = encode(new Uint8ClampedArray(pixels), info.width, info.height, 4, 3);
    const result = await placeholder(source, 'blurhash');
    expect(result.placeholderHash).toBe(expected);
    expect(
      (await sharp(Buffer.from(result.placeholder!.split(',')[1]!, 'base64')).metadata()).format,
    ).toBe('webp');
  });
});

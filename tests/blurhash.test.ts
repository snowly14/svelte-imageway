import {
  createBlurhashDecodeControl,
  gammaThresholds,
  gammaBand,
  referenceSrgb,
  alphabet,
} from '../bench/blurhash-display/control.js';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { encode, decode } from 'blurhash';
import {
  createBlurhashEncoder,
  getBlurhashEncoder,
} from '../packages/svelte-imageway/src/lib/node/blurhash.js';
import { placeholder } from '../packages/svelte-imageway/src/lib/vite/placeholder.js';
import sharp from 'sharp';
import { rgbaToThumbHash, thumbHashToDataURL, thumbHashToRGBA, rgbaToDataURL } from 'thumbhash';
import { createDecodeControl, createPNGControl } from '../bench/lean-preview/control.js';
import { createThumbHashControl } from '../bench/thumbhash/control.js';
const url = new URL('../packages/svelte-imageway/src/lib/node/blurhash.wasm', import.meta.url);
function fixture(width: number, height: number, seed: number): Uint8Array {
  let state = seed;
  return Uint8Array.from({ length: width * height * 4 }, () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state >>> 24;
  });
}
describe('bounded Rust BlurHash kernel', () => {
  it('decodes generated BlurHash previews byte-for-byte and retains owned pixels', async () => {
    const encoder = await getBlurhashEncoder();
    const cached = createBlurhashDecodeControl(),
      thresholds = createBlurhashDecodeControl(true);
    for (let seed = 1; seed <= 1024; seed++) {
      const width = (seed % 32) + 1,
        height = ((seed * 7) % 32) + 1,
        pixels = fixture(width, height, seed);
      const hash = encoder.encode(pixels, width, height);
      const expected = new Uint8Array(decode(hash, 16, 16));
      expect(new Uint8Array(cached(hash))).toEqual(expected);
      expect(new Uint8Array(thresholds(hash))).toEqual(expected);
      const actual = encoder.decodeBlurHash(hash);
      expect(actual).toEqual(expected);
      encoder.encode(fixture(3, 2, seed), 3, 2);
      encoder.thumbHash(pixels, width, height);
      encoder.thumbHashDataURL(rgbaToThumbHash(width, height, pixels));
      expect(actual).toEqual(expected);
      actual.fill(0);
      expect(encoder.decodeBlurHash(hash)).toEqual(expected);
    }
    for (let color = 0; color < 256; color++) {
      const pixels = new Uint8Array(4).fill(color),
        hash = encoder.encode(pixels, 1, 1);
      expect(encoder.decodeBlurHash(hash)).toEqual(new Uint8Array(decode(hash, 16, 16)));
    }
    for (const hash of [
      '',
      'L'.repeat(27),
      'L'.repeat(29),
      '!'.repeat(28),
      'L' + 'é'.repeat(27),
      'L' + '😀'.repeat(13) + 'x',
      'L~' + '~~~~' + '00'.repeat(11),
      'L0' + '0000' + '~~'.repeat(11),
    ])
      expect(() => encoder.decodeBlurHash(hash)).toThrow();
  });
  it('matches reference decoding for arbitrary valid 4x3 coefficient extremes', async () => {
    const kernel = await getBlurhashEncoder();
    const base83 = (value: number, length: number) =>
      Array.from(
        { length },
        (_, i) => alphabet[Math.floor(value / 83 ** (length - i - 1)) % 83],
      ).join('');
    let state = 123;
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state;
    };
    for (let sample = 0; sample < 1024; sample++) {
      let hash = 'L' + alphabet[sample % 83] + base83(random() & 0xffffff, 4);
      for (let i = 0; i < 11; i++)
        hash += base83(sample % 3 === 0 ? 6858 : sample % 3 === 1 ? 0 : random() % 6859, 2);
      expect(kernel.decodeBlurHash(hash)).toEqual(new Uint8Array(decode(hash, 16, 16)));
    }
  });
  it('keeps all sRGB boundaries exact and bounds native fallback storage', async () => {
    const { instance } = await WebAssembly.instantiate(await readFile(url));
    const k = instance.exports as unknown as {
      memory: WebAssembly.Memory;
      thumbhash_ptr(): number;
      tables_ptr(): number;
      pixels_ptr(): number;
      blurhash_tables_ptr(): number;
      gamma_lookup_ptr(): number;
      blurhash_fallback_ptr(): number;
      blurhash_linear_ptr(): number;
      blurhash_decode(n: number): number;
    };
    const hash = new Uint8Array(k.memory.buffer, k.thumbhash_ptr(), 32);
    const zero =
      'L0' + '0000' + (alphabet[Math.floor(3429 / 83)]! + alphabet[3429 % 83]!).repeat(11);
    hash.set(Buffer.from(zero));
    const tables = new Float64Array(k.memory.buffer, k.blurhash_tables_ptr(), 367),
      thresholds = gammaThresholds();
    tables.set(thresholds, 112);
    for (let i = 0; i < 4; i++)
      for (let x = 0; x < 16; x++) tables[i * 16 + x] = Math.cos((Math.PI * x * i) / 16);
    for (let j = 0; j < 3; j++)
      for (let y = 0; y < 16; y++) tables[64 + j * 16 + y] = Math.cos((Math.PI * y * j) / 16);
    const lookup = new Uint8Array(k.memory.buffer, k.gamma_lookup_ptr(), 2048);
    for (let i = 0; i < 2048; i++) lookup[i] = referenceSrgb(i / 2048);
    const srgb = new Float64Array(k.memory.buffer, k.tables_ptr(), 928),
      pixels = new Uint8Array(k.memory.buffer, k.pixels_ptr(), 4096),
      linear = new Float64Array(k.memory.buffer, k.blurhash_linear_ptr(), 768),
      fallback = new Uint16Array(k.memory.buffer, k.blurhash_fallback_ptr(), 768);
    for (let code = 0; code < 255; code++)
      for (const delta of [-2 * gammaBand, -gammaBand / 2, 0, gammaBand / 2, 2 * gammaBand]) {
        const value = thresholds[code]! + delta;
        srgb[0] = value;
        const count = k.blurhash_decode(28);
        if (Math.abs(delta) < gammaBand) {
          expect(count).toBe(769);
          expect(Array.from(fallback)).toEqual(Array.from({ length: 768 }, (_, i) => i));
          expect(linear[0]).toBe(value);
          expect(linear[767]).toBe(value);
        } else {
          expect(count).toBe(1);
          expect(pixels[0]).toBe(referenceSrgb(value));
          expect(pixels[1022]).toBe(referenceSrgb(value));
        }
      }
    for (const length of [0, 27, 29, 0xffffffff]) expect(k.blurhash_decode(length)).toBe(0);
    for (let i = 0; i < 28; i++) {
      hash.set(Buffer.from(zero));
      hash[i] = 0;
      pixels.fill(90);
      expect(k.blurhash_decode(28)).toBe(0);
      expect(pixels.every((v) => v === 90)).toBe(true);
    }
  });
  it('matches ThumbHash bytes across opaque/transparent inputs and retains output ownership', async () => {
    const encoder = await getBlurhashEncoder();
    const control = createThumbHashControl();
    for (let seed = 1; seed <= 200; seed++) {
      const width = (seed % 32) + 1,
        height = ((seed * 11) % 32) + 1;
      const pixels = fixture(width, height, seed);
      if (seed % 2) for (let i = 3; i < pixels.length; i += 4) pixels[i] = 255;
      const snapshot = pixels.slice();
      const expected = rgbaToThumbHash(width, height, pixels);
      expect(control(pixels, width, height)).toEqual(expected);
      const actual = encoder.thumbHash(pixels, width, height);
      expect(actual).toEqual(expected);
      expect(pixels).toEqual(snapshot);
      encoder.encode(fixture(3, 2, seed), 3, 2);
      encoder.thumbHash(fixture(2, 3, seed + 1), 2, 3);
      encoder.dominantColor(pixels, width, height);
      expect(actual).toEqual(expected);
      actual.fill(0);
      expect(encoder.thumbHash(pixels, width, height)).toEqual(expected);
    }
    for (const value of [0, 127, 255]) {
      const pixels = new Uint8Array(32 * 32 * 4).fill(value);
      expect(encoder.thumbHash(pixels, 32, 32)).toEqual(rgbaToThumbHash(32, 32, pixels));
    }
    for (const [width, height] of [
      [0, 1],
      [33, 1],
      [1, 33],
      [1.5, 1],
      [NaN, 1],
      [Infinity, 1],
    ])
      expect(() => encoder.thumbHash(new Uint8Array(4), width!, height!)).toThrow();
    expect(() => encoder.thumbHash(new Uint8Array(3), 1, 1)).toThrow();
  });
  it('decodes ThumbHash pixels byte-for-byte with bounded memory and owned output', async () => {
    const encoder = await getBlurhashEncoder();
    const control = createDecodeControl(),
      png = createPNGControl();
    for (let seed = 1; seed <= 256; seed++) {
      const width = (seed % 32) + 1,
        height = ((seed * 13) % 32) + 1;
      const input = fixture(width, height, seed);
      if (seed % 2) for (let i = 3; i < input.length; i += 4) input[i] = 255;
      const hash = rgbaToThumbHash(width, height, input);
      const snapshot = hash.slice();
      const expected = thumbHashToRGBA(hash);
      const actual = encoder.decodeThumbHash(hash);
      expect(actual).toEqual(expected);
      expect(control(hash)).toEqual(expected);
      expect(png(actual.w, actual.h, actual.rgba)).toBe(thumbHashToDataURL(hash));
      expect(rgbaToDataURL(actual.w, actual.h, actual.rgba)).toBe(thumbHashToDataURL(hash));
      expect(encoder.thumbHashDataURL(hash)).toBe(thumbHashToDataURL(hash));
      expect(hash).toEqual(snapshot);
      encoder.thumbHash(input, width, height);
      encoder.encode(input, width, height);
      encoder.dominantColor(input, width, height);
      expect(actual).toEqual(expected);
      actual.rgba.fill(0);
      expect(encoder.decodeThumbHash(hash)).toEqual(expected);
    }
    const valid = rgbaToThumbHash(32, 21, fixture(32, 21, 8));
    for (let length = 0; length < valid.length; length++)
      expect(() => encoder.decodeThumbHash(valid.slice(0, length))).toThrow(/ThumbHash/);
    expect(() => encoder.decodeThumbHash(new Uint8Array(26))).toThrow();
    expect(() => encoder.decodeThumbHash(new Uint8Array(5))).toThrow();
    expect(() => encoder.decodeThumbHash(Uint8Array.from([...valid, 0]))).toThrow();
  });
  it('preserves the complete reference ThumbHash PNG preview', async () => {
    const source = await sharp(fixture(32, 21, 123), {
      raw: { width: 32, height: 21, channels: 4 },
    })
      .png()
      .toBuffer();
    const { data, info } = await sharp(source)
      .autoOrient()
      .resize({ width: 32, height: 32, fit: 'inside', withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const hash = rgbaToThumbHash(info.width, info.height, data);
    const preview = await placeholder(source, 'thumbhash');
    expect(preview.placeholderHash).toBe(Buffer.from(hash).toString('base64'));
    expect(preview.placeholder).toBe(thumbHashToDataURL(hash));
  });
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
    const thumb = instance.exports.thumbhash as (w: number, h: number) => number;
    const png = instance.exports.rgba_png as (w: number, h: number) => number;
    const unhash = instance.exports.thumbhash_decode as (
      w: number,
      h: number,
      length: number,
    ) => number;
    for (const [w, h] of [
      [0, 32],
      [33, 32],
      [32, 33],
      [0xffffffff, 1],
    ]) {
      expect(run(w!, h!)).toBe(0);
      expect(thumb(w!, h!)).toBe(0);
      expect(png(w!, h!)).toBe(0);
      expect(unhash(w!, h!, 25)).toBe(0);
    }
    for (const length of [0, 4, 26, 0xffffffff]) expect(unhash(32, 32, length)).toBe(0);
    const pointer = (instance.exports.pixels_ptr as () => number)();
    const pngPointer = (instance.exports.png_ptr as () => number)();
    for (const value of [0, 127, 255]) {
      const input = new Uint8Array(4096).fill(value);
      new Uint8Array(memory.buffer, pointer, 4096).set(input);
      const length = png(32, 32);
      expect(length).toBe(4351);
      const actual = Buffer.from(memory.buffer, pngPointer, length).toString('base64');
      expect(`data:image/png;base64,${actual}`).toBe(rgbaToDataURL(32, 32, input));
    }
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
    const reference = await sharp(Buffer.from(decode(expected, 16, 16)), {
      raw: { width: 16, height: 16, channels: 4 },
    })
      .webp({ quality: 20 })
      .toBuffer();
    expect(result.placeholder).toBe(`data:image/webp;base64,${reference.toString('base64')}`);
    expect(
      (await sharp(Buffer.from(result.placeholder!.split(',')[1]!, 'base64')).metadata()).format,
    ).toBe('webp');
  });
});

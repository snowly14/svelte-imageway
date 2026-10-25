import { readFile } from 'node:fs/promises';
import { invariant } from '../core/errors.js';
import { packBlurhash, linearToSrgb } from './blurhash-encoding.js';
interface Kernel {
  memory: WebAssembly.Memory;
  pixels_ptr(): number;
  tables_ptr(): number;
  output_ptr(): number;
  coefficients(width: number, height: number): number;
  dominant_colour(width: number, height: number): number;
  thumbhash_ptr(): number;
  thumbhash(width: number, height: number): number;
  thumbhash_decode(width: number, height: number, length: number): number;
  decode_tables_ptr(): number;
  png_ptr(): number;
  rgba_png(width: number, height: number): number;
  blurhash_tables_ptr(): number;
  gamma_lookup_ptr(): number;
  blurhash_fallback_ptr(): number;
  blurhash_linear_ptr(): number;
  blurhash_decode(length: number): number;
}
export interface BlurhashEncoder {
  /** Exact display path for the internally generated 4x3 hash at 16x16 pixels. */
  decodeBlurHash(hash: string): Uint8Array;
  encode(pixels: Uint8Array, width: number, height: number): string;
  /** Undefined preserves libvips tie-breaking when histogram maxima are ambiguous. */
  dominantColor(pixels: Uint8Array, width: number, height: number): string | undefined;
  thumbHash(pixels: Uint8Array, width: number, height: number): Uint8Array;
  thumbHashDataURL(hash: Uint8Array): string;
  decodeThumbHash(hash: Uint8Array): { w: number; h: number; rgba: Uint8Array };
}
function validate(pixels: Uint8Array, width: number, height: number): void {
  invariant(
    Number.isSafeInteger(width) &&
      Number.isSafeInteger(height) &&
      width > 0 &&
      height > 0 &&
      width <= 32 &&
      height <= 32 &&
      pixels.length === width * height * 4,
    'PREVIEW_PIXELS',
    'Preview math requires matching RGBA pixels with dimensions between 1 and 32.',
  );
}
/** One fixed-memory, synchronous instance per module/worker; never shipped to the browser. */
export async function createBlurhashEncoder(bytes: Uint8Array): Promise<BlurhashEncoder> {
  const { instance } = await WebAssembly.instantiate(new Uint8Array(bytes));
  const exports = instance.exports;
  invariant(
    exports.memory instanceof WebAssembly.Memory &&
      [
        'pixels_ptr',
        'tables_ptr',
        'output_ptr',
        'coefficients',
        'dominant_colour',
        'thumbhash_ptr',
        'thumbhash',
        'thumbhash_decode',
        'png_ptr',
        'decode_tables_ptr',
        'rgba_png',
        'blurhash_tables_ptr',
        'gamma_lookup_ptr',
        'blurhash_fallback_ptr',
        'blurhash_linear_ptr',
        'blurhash_decode',
      ].every((key) => typeof exports[key] === 'function'),
    'PREVIEW_ABI',
    'Invalid bundled preview kernel. Reinstall svelte-imageway or rebuild its native artifact.',
  );
  const kernel = exports as unknown as Kernel;
  const pixels = new Uint8Array(kernel.memory.buffer, kernel.pixels_ptr(), 4096);
  const tables = new Float64Array(kernel.memory.buffer, kernel.tables_ptr(), 928);
  const decodeTables = new Float64Array(kernel.memory.buffer, kernel.decode_tables_ptr(), 448);
  const png = new Uint8Array(kernel.memory.buffer, kernel.png_ptr(), 4400);
  const thumb = new Uint8Array(kernel.memory.buffer, kernel.thumbhash_ptr(), 32);
  const coefficients = new Float64Array(kernel.memory.buffer, kernel.output_ptr(), 36);
  for (let i = 0; i < 256; i++) {
    const v = i / 255;
    tables[i] = v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }
  const blurTables = new Float64Array(kernel.memory.buffer, kernel.blurhash_tables_ptr(), 367);
  const gammaLookup = new Uint8Array(kernel.memory.buffer, kernel.gamma_lookup_ptr(), 2048);
  const fallback = new Uint16Array(kernel.memory.buffer, kernel.blurhash_fallback_ptr(), 768);
  const linear = new Float64Array(kernel.memory.buffer, kernel.blurhash_linear_ptr(), 768);
  let blurReady = false;
  function prepareBlurDecode() {
    if (blurReady) return;
    for (let i = 0; i < 4; i++)
      for (let x = 0; x < 16; x++) blurTables[i * 16 + x] = Math.cos((Math.PI * x * i) / 16);
    for (let j = 0; j < 3; j++)
      for (let y = 0; y < 16; y++) blurTables[64 + j * 16 + y] = Math.cos((Math.PI * y * j) / 16);
    for (let i = 0; i < 255; i++) {
      const v = (i + 0.5) / 255;
      const boundary = v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      invariant(
        linearToSrgb(boundary - 1e-7) === i && linearToSrgb(boundary + 1e-7) === i + 1,
        'PREVIEW_ABI',
        'Runtime sRGB rounding does not match preview bounds.',
      );
      blurTables[112 + i] = boundary;
    }
    for (let i = 0; i < 2048; i++) gammaLookup[i] = linearToSrgb(i / 2048);
    blurReady = true;
  }
  let previousWidth = 0,
    previousHeight = 0;
  let thumbWidth = 0,
    thumbHeight = 0;
  let decodeWidth = 0,
    decodeHeight = 0;
  function decodeThumb(hash: Uint8Array) {
    const short = hash[3]! & 7;
    invariant(
      hash.length >= 5 && hash.length <= 25 && short > 0,
      'PREVIEW_HASH',
      'Invalid bounded ThumbHash.',
    );
    const long = hash[2]! & 128 ? 5 : 7;
    const landscape = !!(hash[4]! & 128);
    const ratio = landscape ? long / short : short / long;
    const w = Math.round(ratio > 1 ? 32 : 32 * ratio);
    const h = Math.round(ratio > 1 ? 32 / ratio : 32);
    if (w !== decodeWidth || h !== decodeHeight) {
      for (let i = 0; i < 7; i++) {
        for (let x = 0; x < w; x++)
          decodeTables[i * 32 + x] = Math.cos((Math.PI / w) * (x + 0.5) * i);
        for (let y = 0; y < h; y++)
          decodeTables[224 + i * 32 + y] = Math.cos((Math.PI / h) * (y + 0.5) * i);
      }
      decodeWidth = w;
      decodeHeight = h;
    }
    thumb.fill(0);
    thumb.set(hash);
    invariant(
      kernel.thumbhash_decode(w, h, hash.length) === 1,
      'PREVIEW_HASH',
      'Invalid bounded ThumbHash.',
    );
    return { w, h };
  }
  return {
    decodeBlurHash(hash) {
      invariant(
        typeof hash === 'string' && hash.length === 28 && hash[0] === 'L',
        'PREVIEW_HASH',
        'BlurHash display requires the generated 4x3 hash.',
      );
      prepareBlurDecode();
      for (let i = 0; i < 28; i++) {
        const code = hash.charCodeAt(i);
        invariant(code < 128, 'PREVIEW_HASH', 'Invalid bounded BlurHash.');
        thumb[i] = code;
      }
      const count = kernel.blurhash_decode(28);
      invariant(count > 0 && count <= 769, 'PREVIEW_HASH', 'Invalid bounded BlurHash.');
      for (let i = 0; i < count - 1; i++) {
        const channel = fallback[i]!;
        invariant(channel < 768, 'PREVIEW_ABI', 'Invalid preview fallback index.');
        pixels[Math.floor(channel / 3) * 4 + (channel % 3)] = linearToSrgb(linear[channel]!);
      }
      return pixels.slice(0, 1024);
    },
    thumbHashDataURL(hash) {
      const { w, h } = decodeThumb(hash);
      const length = kernel.rgba_png(w, h);
      invariant(
        length > 0 && length <= png.length,
        'PREVIEW_PIXELS',
        'PNG kernel rejected dimensions.',
      );
      return `data:image/png;base64,${Buffer.from(png.buffer, png.byteOffset, length).toString('base64')}`;
    },
    decodeThumbHash(hash) {
      const { w, h } = decodeThumb(hash);
      return { w, h, rgba: pixels.slice(0, w * h * 4) };
    },
    thumbHash(input, width, height) {
      validate(input, width, height);
      if (width !== thumbWidth || height !== thumbHeight) {
        for (let i = 0; i < 7; i++) {
          for (let x = 0; x < width; x++)
            tables[480 + i * 32 + x] = Math.cos((Math.PI / width) * i * (x + 0.5));
          for (let y = 0; y < height; y++)
            tables[704 + i * 32 + y] = Math.cos((Math.PI / height) * i * (y + 0.5));
        }
        thumbWidth = width;
        thumbHeight = height;
      }
      pixels.set(input);
      const length = kernel.thumbhash(width, height);
      invariant(
        length > 0 && length <= 25,
        'PREVIEW_PIXELS',
        'ThumbHash kernel rejected the dimensions.',
      );
      return thumb.slice(0, length);
    },
    dominantColor(input, width, height) {
      validate(input, width, height);
      pixels.set(input);
      const packed = kernel.dominant_colour(width, height);
      return packed ? `#${packed.toString(16).padStart(6, '0')}` : undefined;
    },
    encode(input, width, height) {
      validate(input, width, height);
      if (width !== previousWidth || height !== previousHeight) {
        for (let i = 0; i < 4; i++)
          for (let x = 0; x < width; x++)
            tables[256 + i * 32 + x] = Math.cos((Math.PI * i * x) / width);
        for (let j = 0; j < 3; j++)
          for (let y = 0; y < height; y++)
            tables[384 + j * 32 + y] = Math.cos((Math.PI * j * y) / height);
        previousWidth = width;
        previousHeight = height;
      }
      pixels.set(input);
      invariant(
        kernel.coefficients(width, height) === 1,
        'PREVIEW_PIXELS',
        'BlurHash kernel rejected the dimensions.',
      );
      return packBlurhash(coefficients);
    },
  };
}
let encoder: Promise<BlurhashEncoder> | undefined;
/** Lazily compiled for build preview colour/hash math; none never loads the kernel. */
export function getBlurhashEncoder(): Promise<BlurhashEncoder> {
  return (encoder ??= readFile(new URL('./blurhash.wasm', import.meta.url)).then(
    createBlurhashEncoder,
  ));
}

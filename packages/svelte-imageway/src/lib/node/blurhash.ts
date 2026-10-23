import { readFile } from 'node:fs/promises';
import { invariant } from '../core/errors.js';
import { packBlurhash } from './blurhash-encoding.js';
interface Kernel {
  memory: WebAssembly.Memory;
  pixels_ptr(): number;
  tables_ptr(): number;
  output_ptr(): number;
  coefficients(width: number, height: number): number;
  dominant_colour(width: number, height: number): number;
  thumbhash_ptr(): number;
  thumbhash(width: number, height: number): number;
}
export interface BlurhashEncoder {
  encode(pixels: Uint8Array, width: number, height: number): string;
  /** Undefined preserves libvips tie-breaking when histogram maxima are ambiguous. */
  dominantColor(pixels: Uint8Array, width: number, height: number): string | undefined;
  thumbHash(pixels: Uint8Array, width: number, height: number): Uint8Array;
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
      ].every((key) => typeof exports[key] === 'function'),
    'PREVIEW_ABI',
    'Invalid bundled preview kernel. Reinstall svelte-imageway or rebuild its native artifact.',
  );
  const kernel = exports as unknown as Kernel;
  const pixels = new Uint8Array(kernel.memory.buffer, kernel.pixels_ptr(), 4096);
  const tables = new Float64Array(kernel.memory.buffer, kernel.tables_ptr(), 928);
  const thumb = new Uint8Array(kernel.memory.buffer, kernel.thumbhash_ptr(), 32);
  const coefficients = new Float64Array(kernel.memory.buffer, kernel.output_ptr(), 36);
  for (let i = 0; i < 256; i++) {
    const v = i / 255;
    tables[i] = v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }
  let previousWidth = 0,
    previousHeight = 0;
  let thumbWidth = 0,
    thumbHeight = 0;
  return {
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

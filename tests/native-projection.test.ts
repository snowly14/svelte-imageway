import { expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
const file = new URL('../packages/svelte-imageway/src/lib/node/blurhash.wasm', import.meta.url);
interface Raw {
  memory: WebAssembly.Memory;
  tables_ptr(): number;
  pixels_ptr(): number;
  output_ptr(): number;
  coefficients(w: number, h: number): number;
}
async function kernel() {
  const { instance } = await WebAssembly.instantiate(await readFile(file));
  return instance.exports as unknown as Raw;
}
it('preserves every projection coefficient bit after bounded column conversion', async () => {
  const k = await kernel(),
    t = new Float64Array(k.memory.buffer, k.tables_ptr(), 928),
    p = new Uint8Array(k.memory.buffer, k.pixels_ptr(), 4096),
    out = new Float64Array(k.memory.buffer, k.output_ptr(), 36);
  for (let i = 0; i < 256; i++) {
    const v = i / 255;
    t[i] = v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }
  let state = 1;
  for (let seed = 0; seed < 64; seed++) {
    const w = (seed % 32) + 1,
      h = ((seed * 13) % 32) + 1;
    for (let i = 0; i < w * h * 4; i++) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      p[i] = state >>> 24;
    }
    for (let i = 0; i < 4; i++)
      for (let x = 0; x < w; x++) t[256 + i * 32 + x] = Math.cos((Math.PI * i * x) / w);
    for (let j = 0; j < 3; j++)
      for (let y = 0; y < h; y++) t[384 + j * 32 + y] = Math.cos((Math.PI * j * y) / h);
    const expected = new Float64Array(36);
    for (let j = 0; j < 3; j++)
      for (let i = 0; i < 4; i++) {
        let r = 0,
          g = 0,
          b = 0;
        const norm = i === 0 && j === 0 ? 1 : 2;
        for (let x = 0; x < w; x++)
          for (let y = 0; y < h; y++) {
            const basis = norm * t[256 + i * 32 + x]! * t[384 + j * 32 + y]!,
              o = (y * w + x) * 4;
            r += basis * t[p[o]!]!;
            g += basis * t[p[o + 1]!]!;
            b += basis * t[p[o + 2]!]!;
          }
        const scale = 1 / (w * h),
          o = (j * 4 + i) * 3;
        expected[o] = r * scale;
        expected[o + 1] = g * scale;
        expected[o + 2] = b * scale;
      }
    expect(k.coefficients(w, h)).toBe(1);
    expect(Buffer.from(out.buffer, out.byteOffset, out.byteLength)).toEqual(
      Buffer.from(expected.buffer),
    );
  }
  const snapshot = out.slice();
  for (const [w, h] of [
    [0, 1],
    [1, 0],
    [33, 32],
    [32, 33],
    [0xffffffff, 1],
  ]) {
    expect(k.coefficients(w!, h!)).toBe(0);
    expect(out).toEqual(snapshot);
  }
});

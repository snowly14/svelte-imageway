import { packBlurhash } from '../packages/svelte-imageway/dist/node/blurhash-encoding.js';
/** Optimized JS control: same lookup caching and reference-order arithmetic as Rust. */
export function optimizedJS() {
  const tables = new Float64Array(480),
    output = new Float64Array(36);
  for (let i = 0; i < 256; i++) {
    const v = i / 255;
    tables[i] = v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }
  let pw = 0,
    ph = 0;
  return (data: Uint8Array, w: number, h: number) => {
    if (w !== pw || h !== ph) {
      for (let i = 0; i < 4; i++)
        for (let x = 0; x < w; x++) tables[256 + i * 32 + x] = Math.cos((Math.PI * i * x) / w);
      for (let j = 0; j < 3; j++)
        for (let y = 0; y < h; y++) tables[384 + j * 32 + y] = Math.cos((Math.PI * j * y) / h);
      pw = w;
      ph = h;
    }
    let k = 0;
    for (let j = 0; j < 3; j++)
      for (let i = 0; i < 4; i++) {
        const norm = i === 0 && j === 0 ? 1 : 2;
        let r = 0,
          g = 0,
          b = 0;
        for (let x = 0; x < w; x++)
          for (let y = 0; y < h; y++) {
            const basis = norm * tables[256 + i * 32 + x]! * tables[384 + j * 32 + y]!;
            const p = (y * w + x) * 4;
            r += basis * tables[data[p]!]!;
            g += basis * tables[data[p + 1]!]!;
            b += basis * tables[data[p + 2]!]!;
          }
        const scale = 1 / (w * h);
        output[k++] = r * scale;
        output[k++] = g * scale;
        output[k++] = b * scale;
      }
    return packBlurhash(output);
  };
}

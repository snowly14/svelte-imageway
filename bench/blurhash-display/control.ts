/** Bounded 4x3/16x16 JS control; reference arithmetic with cached trigonometry/scratch. */
export const alphabet =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~';
export const gammaBand = 1e-7;
export function referenceSrgb(value: number): number {
  const v = Math.max(0, Math.min(1, value));
  return v <= 0.0031308
    ? Math.trunc(v * 12.92 * 255 + 0.5)
    : Math.trunc((1.055 * v ** (1 / 2.4) - 0.055) * 255 + 0.5);
}
export function gammaThresholds() {
  const table = new Float64Array(255);
  for (let i = 0; i < 255; i++) {
    const value = (i + 0.5) / 255;
    table[i] = value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    if (
      referenceSrgb(table[i]! - gammaBand) !== i ||
      referenceSrgb(table[i]! + gammaBand) !== i + 1
    )
      throw Error('Unsupported sRGB rounding bounds.');
  }
  return table;
}
export function createBlurhashDecodeControl(thresholdGamma = false, clamped = true) {
  const gammaLookup = thresholdGamma
    ? Uint8Array.from({ length: 2048 }, (_, i) => referenceSrgb(i / 2048))
    : new Uint8Array();
  const lookup = new Int16Array(128).fill(-1),
    coefficients = new Float64Array(36),
    srgb = new Float64Array(256),
    cos = new Float64Array(112),
    thresholds = thresholdGamma ? gammaThresholds() : new Float64Array();
  for (let i = 0; i < 83; i++) lookup[alphabet.charCodeAt(i)] = i;
  for (let i = 0; i < 256; i++) {
    const v = i / 255;
    srgb[i] = v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }
  for (let i = 0; i < 4; i++)
    for (let x = 0; x < 16; x++) cos[i * 16 + x] = Math.cos((Math.PI * x * i) / 16);
  for (let j = 0; j < 3; j++)
    for (let y = 0; y < 16; y++) cos[64 + j * 16 + y] = Math.cos((Math.PI * y * j) / 16);
  function decode83(hash: string, start: number, length: number) {
    let value = 0;
    for (let i = start; i < start + length; i++) {
      const code = hash.charCodeAt(i);
      if (code >= 128 || lookup[code]! < 0) throw Error('Invalid bounded BlurHash.');
      value = value * 83 + lookup[code]!;
    }
    return value;
  }
  function gamma(v: number) {
    if (!thresholdGamma) return referenceSrgb(v);
    if (v <= 0) return 0;
    if (v >= 1) return 255;
    let low = gammaLookup[Math.trunc(v * 2048)]!;
    while (low < 255 && v >= thresholds[low]!) low++;
    if (
      (low > 0 && Math.abs(v - thresholds[low - 1]!) <= gammaBand) ||
      (low < 255 && Math.abs(v - thresholds[low]!) <= gammaBand)
    )
      return referenceSrgb(v);
    return low;
  }
  return (hash: string) => {
    if (hash.length !== 28 || hash[0] !== 'L') throw Error('Invalid bounded BlurHash.');
    const scale = (decode83(hash, 1, 1) + 1) / 166,
      dc = decode83(hash, 2, 4);
    if (dc > 0xffffff) throw Error('Invalid bounded BlurHash DC.');
    coefficients[0] = srgb[dc >> 16]!;
    coefficients[1] = srgb[(dc >> 8) & 255]!;
    coefficients[2] = srgb[dc & 255]!;
    for (let i = 1; i < 12; i++) {
      const value = decode83(hash, 4 + i * 2, 2);
      if (value > 6858) throw Error('Invalid bounded BlurHash AC.');
      for (let c = 0; c < 3; c++) {
        const q =
          c === 0 ? Math.floor(value / 361) : c === 1 ? Math.floor(value / 19) % 19 : value % 19;
        const v = (q - 9) / 9;
        coefficients[i * 3 + c] = (v < 0 ? -1 : 1) * Math.abs(v) ** 2 * scale;
      }
    }
    const out = clamped ? new Uint8ClampedArray(1024) : new Uint8Array(1024);
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        let r = 0,
          g = 0,
          b = 0;
        for (let j = 0; j < 3; j++)
          for (let i = 0; i < 4; i++) {
            const basis = cos[i * 16 + x]! * cos[64 + j * 16 + y]!,
              k = (i + j * 4) * 3;
            r += coefficients[k]! * basis;
            g += coefficients[k + 1]! * basis;
            b += coefficients[k + 2]! * basis;
          }
        const offset = (y * 16 + x) * 4;
        out[offset] = gamma(r);
        out[offset + 1] = gamma(g);
        out[offset + 2] = gamma(b);
        out[offset + 3] = 255;
      }
    return out;
  };
}

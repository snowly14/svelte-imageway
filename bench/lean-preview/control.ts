// Adapted from Evan Wallace's MIT ThumbHash reference (native/blurhash/NOTICE).
// Bounded JS control: same output, cached cosine tables, no WASM input copy.
export function createDecodeControl() {
  const xs = new Float64Array(224),
    ys = new Float64Array(224);
  const scratch = Array.from({ length: 4 }, () => new Float64Array(28));
  const fx = new Float64Array(7),
    fy = new Float64Array(7);
  let previousWidth = 0,
    previousHeight = 0;
  return function decode(hash: Uint8Array) {
    if (hash.length < 5 || hash.length > 25 || !(hash[3]! & 7))
      throw Error('Invalid bounded ThumbHash.');
    const { PI, min, max, cos, round } = Math;

    // Read the constants
    const header24 = hash[0]! | (hash[1]! << 8) | (hash[2]! << 16);
    const header16 = hash[3]! | (hash[4]! << 8);
    const l_dc = (header24 & 63) / 63;
    const p_dc = ((header24 >> 6) & 63) / 31.5 - 1;
    const q_dc = ((header24 >> 12) & 63) / 31.5 - 1;
    const l_scale = ((header24 >> 18) & 31) / 31;
    const hasAlpha = header24 >> 23;
    const p_scale = ((header16 >> 3) & 63) / 63;
    const q_scale = ((header16 >> 9) & 63) / 63;
    const isLandscape = header16 >> 15;
    const lx = max(3, isLandscape ? (hasAlpha ? 5 : 7) : header16 & 7);
    const ly = max(3, isLandscape ? header16 & 7 : hasAlpha ? 5 : 7);
    const a_dc = hasAlpha ? (hash[5]! & 15) / 15 : 1;
    const a_scale = (hash[5]! >> 4) / 15;

    // Read the varying factors (boost saturation by 1.25x to compensate for quantization)
    const ac_start = hasAlpha ? 6 : 5;
    let ac_index = 0;
    let channel = 0;
    const decodeChannel = (nx: number, ny: number, scale: number) => {
      const ac = scratch[channel++]!;
      let used = 0;
      for (let cy = 0; cy < ny; cy++)
        for (let cx = cy ? 0 : 1; cx * ny < nx * (ny - cy); cx++)
          ac[used++] =
            (((hash[ac_start + (ac_index >> 1)]! >> ((ac_index++ & 1) << 2)) & 15) / 7.5 - 1) *
            scale;
      return ac;
    };
    const l_ac = decodeChannel(lx, ly, l_scale);
    const p_ac = decodeChannel(3, 3, p_scale * 1.25);
    const q_ac = decodeChannel(3, 3, q_scale * 1.25);
    const a_ac = hasAlpha && decodeChannel(5, 5, a_scale);

    // Decode using the DCT into RGB
    const ratio =
      (isLandscape ? (hasAlpha ? 5 : 7) : header16 & 7) /
      (isLandscape ? header16 & 7 : hasAlpha ? 5 : 7);
    const w = round(ratio > 1 ? 32 : 32 * ratio);
    const h = round(ratio > 1 ? 32 / ratio : 32);
    if (w !== previousWidth || h !== previousHeight) {
      for (let c = 0; c < 7; c++) {
        for (let x = 0; x < w; x++) xs[c * 32 + x] = cos((PI / w) * (x + 0.5) * c);
        for (let y = 0; y < h; y++) ys[c * 32 + y] = cos((PI / h) * (y + 0.5) * c);
      }
      previousWidth = w;
      previousHeight = h;
    }
    const rgba = new Uint8Array(w * h * 4);
    for (let y = 0, i = 0; y < h; y++) {
      for (let x = 0; x < w; x++, i += 4) {
        let l = l_dc,
          p = p_dc,
          q = q_dc,
          a = a_dc;

        // Precompute the coefficients
        for (let cx = 0, n = max(lx, hasAlpha ? 5 : 3); cx < n; cx++) fx[cx] = xs[cx * 32 + x]!;
        for (let cy = 0, n = max(ly, hasAlpha ? 5 : 3); cy < n; cy++) fy[cy] = ys[cy * 32 + y]!;

        // Decode L
        for (let cy = 0, j = 0; cy < ly; cy++)
          for (let cx = cy ? 0 : 1, fy2 = fy[cy]! * 2; cx * ly < lx * (ly - cy); cx++, j++)
            l += l_ac[j]! * fx[cx]! * fy2;

        // Decode P and Q
        for (let cy = 0, j = 0; cy < 3; cy++) {
          for (let cx = cy ? 0 : 1, fy2 = fy[cy]! * 2; cx < 3 - cy; cx++, j++) {
            const f = fx[cx]! * fy2;
            p += p_ac[j]! * f;
            q += q_ac[j]! * f;
          }
        }

        // Decode A
        if (hasAlpha)
          for (let cy = 0, j = 0; cy < 5; cy++)
            for (let cx = cy ? 0 : 1, fy2 = fy[cy]! * 2; cx < 5 - cy; cx++, j++)
              a += (a_ac as Float64Array)[j]! * fx[cx]! * fy2;

        // Convert to RGB
        const b = l - (2 / 3) * p;
        const r = (3 * l - b + q) / 2;
        const g = r - q;
        rgba[i] = max(0, 255 * min(1, r));
        rgba[i + 1] = max(0, 255 * min(1, g));
        rgba[i + 2] = max(0, 255 * min(1, b));
        rgba[i + 3] = max(0, 255 * min(1, a));
      }
    }
    return { w, h, rgba };
  };
}

/** Bounded typed-array PNG control, identical uncompressed layout/checksums to Rust. */
export function createPNGControl() {
  const bytes = Buffer.alloc(4400);
  const table = Uint32Array.from({ length: 256 }, (_, index) => {
    let c = index;
    for (let bit = 0; bit < 8; bit++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
    return c >>> 0;
  });
  return (w: number, h: number, rgba: Uint8Array) => {
    if (
      !Number.isInteger(w) ||
      !Number.isInteger(h) ||
      w < 1 ||
      h < 1 ||
      w > 32 ||
      h > 32 ||
      rgba.length !== w * h * 4
    )
      throw Error('Invalid bounded PNG.');
    const row = w * 4 + 1,
      idat = 6 + h * (5 + row);
    bytes.set([
      137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 0, 0, 0, 0, 0, 8, 6, 0,
      0, 0, 0, 0, 0, 0,
    ]);
    bytes.writeUInt32BE(w, 16);
    bytes.writeUInt32BE(h, 20);
    bytes.writeUInt32BE(idat, 33);
    bytes.set([73, 68, 65, 84, 120, 1], 37);
    let offset = 43,
      a = 1,
      b = 0;
    for (let y = 0; y < h; y++) {
      bytes.set([y + 1 < h ? 0 : 1, row & 255, row >> 8, ~row & 255, (row >> 8) ^ 255, 0], offset);
      offset += 6;
      b += a;
      for (let x = 0; x < w * 4; x++) {
        const value = rgba[y * w * 4 + x]!;
        bytes[offset++] = value;
        a += value;
        b += a;
      }
      a %= 65521;
      b %= 65521;
    }
    bytes.writeUInt32BE(((b << 16) | a) >>> 0, offset);
    offset += 4;
    bytes.set([0, 0, 0, 0, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130], offset);
    for (const [start, end] of [
      [12, 29],
      [37, 41 + idat],
    ] as const) {
      let c = ~0;
      for (let i = start; i < end; i++) {
        c = (c >>> 8) ^ table[(c ^ bytes[i]!) & 255]!;
      }
      bytes.writeUInt32BE(~c >>> 0, end);
    }
    return `data:image/png;base64,${bytes.subarray(0, offset + 16).toString('base64')}`;
  };
}

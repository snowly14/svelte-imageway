// Bounded, cosine-cached JS control. ThumbHash algorithm: Evan Wallace, MIT;
// see native/blurhash/NOTICE. Matches Rust's arithmetic/order and scratch reuse.
export function createThumbHashControl() {
  const cos = new Float64Array(448),
    plane = new Float64Array(1024);
  const ac = new Float64Array(28),
    dc = new Float64Array(4),
    scales = new Float64Array(4);
  const output = new Uint8Array(32);
  let previousWidth = 0,
    previousHeight = 0;
  return (pixels: Uint8Array, w: number, h: number) => {
    if (
      !Number.isSafeInteger(w) ||
      !Number.isSafeInteger(h) ||
      w < 1 ||
      h < 1 ||
      w > 32 ||
      h > 32 ||
      pixels.length !== w * h * 4
    )
      throw Error('Invalid RGBA dimensions.');
    if (w !== previousWidth || h !== previousHeight) {
      for (let i = 0; i < 7; i++) {
        for (let x = 0; x < w; x++) cos[i * 32 + x] = Math.cos((Math.PI / w) * i * (x + 0.5));
        for (let y = 0; y < h; y++) cos[224 + i * 32 + y] = Math.cos((Math.PI / h) * i * (y + 0.5));
      }
      previousWidth = w;
      previousHeight = h;
    }
    let red = 0,
      green = 0,
      blue = 0,
      totalAlpha = 0;
    const count = w * h;
    for (let i = 0; i < count; i++) {
      const offset = i * 4,
        a = pixels[offset + 3]! / 255;
      red += (a / 255) * pixels[offset]!;
      green += (a / 255) * pixels[offset + 1]!;
      blue += (a / 255) * pixels[offset + 2]!;
      totalAlpha += a;
    }
    if (totalAlpha) {
      red /= totalAlpha;
      green /= totalAlpha;
      blue /= totalAlpha;
    }
    const alpha = totalAlpha < count,
      limit = alpha ? 5 : 7;
    const lx = Math.max(1, Math.round((limit * w) / Math.max(w, h)));
    const ly = Math.max(1, Math.round((limit * h) / Math.max(w, h)));
    const start = alpha ? 6 : 5;
    let acIndex = 0;
    output.fill(0);
    scales.fill(0);
    for (let channel = 0; channel < (alpha ? 4 : 3); channel++) {
      for (let i = 0; i < count; i++) {
        const offset = i * 4,
          a = pixels[offset + 3]! / 255;
        const r = red * (1 - a) + (a / 255) * pixels[offset]!;
        const g = green * (1 - a) + (a / 255) * pixels[offset + 1]!;
        const b = blue * (1 - a) + (a / 255) * pixels[offset + 2]!;
        plane[i] =
          channel === 0
            ? (r + g + b) / 3
            : channel === 1
              ? (r + g) / 2 - b
              : channel === 2
                ? r - g
                : a;
      }
      const nx = channel === 0 ? Math.max(3, lx) : channel === 3 ? 5 : 3;
      const ny = channel === 0 ? Math.max(3, ly) : channel === 3 ? 5 : 3;
      let used = 0;
      for (let cy = 0; cy < ny; cy++)
        for (let cx = 0; cx * ny < nx * (ny - cy); cx++) {
          let value = 0;
          for (let y = 0; y < h; y++) {
            const fy = cos[224 + cy * 32 + y]!;
            for (let x = 0; x < w; x++) value += plane[x + y * w]! * cos[cx * 32 + x]! * fy;
          }
          value /= count;
          if (!cx && !cy) dc[channel] = value;
          else {
            ac[used++] = value;
            scales[channel] = Math.max(scales[channel]!, Math.abs(value));
          }
        }
      for (let i = 0; i < used; i++) {
        const value = scales[channel] ? 0.5 + (0.5 / scales[channel]!) * ac[i]! : ac[i]!;
        output[start + (acIndex >> 1)]! |= Math.round(15 * value) << ((acIndex++ & 1) * 4);
      }
    }
    const landscape = w > h;
    const header24 =
      Math.round(63 * dc[0]!) |
      (Math.round(31.5 + 31.5 * dc[1]!) << 6) |
      (Math.round(31.5 + 31.5 * dc[2]!) << 12) |
      (Math.round(31 * scales[0]!) << 18) |
      (Number(alpha) << 23);
    const header16 =
      (landscape ? ly : lx) |
      (Math.round(63 * scales[1]!) << 3) |
      (Math.round(63 * scales[2]!) << 9) |
      (Number(landscape) << 15);
    output[0] = header24;
    output[1] = header24 >> 8;
    output[2] = header24 >> 16;
    output[3] = header16;
    output[4] = header16 >> 8;
    if (alpha) output[5] = Math.round(15 * dc[3]!) | (Math.round(15 * scales[3]!) << 4);
    return output.slice(0, start + Math.ceil(acIndex / 2));
  };
}

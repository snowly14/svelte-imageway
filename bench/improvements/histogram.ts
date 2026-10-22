/** Same quantization/tie policy as the Rust path, without Sharp stats or WASM. */
export function createHistogramControl() {
  const bins = new Uint16Array(4096);
  return (pixels: Uint8Array, width: number, height: number): string | undefined => {
    if (
      !Number.isSafeInteger(width) ||
      !Number.isSafeInteger(height) ||
      width < 1 ||
      height < 1 ||
      width > 32 ||
      height > 32 ||
      pixels.length !== width * height * 4
    )
      throw Error('Invalid RGBA preview.');
    bins.fill(0);
    for (let i = 0; i < pixels.length; i += 4) {
      const r = Math.floor((pixels[i]! * 16) / 257),
        g = Math.floor((pixels[i + 1]! * 16) / 257),
        b = Math.floor((pixels[i + 2]! * 16) / 257);
      const index = (r << 8) | (g << 4) | b;
      bins[index] = bins[index]! + 1;
    }
    let maximum = 0,
      winner = 0,
      tied = false;
    for (let i = 0; i < bins.length; i++) {
      if (bins[i]! > maximum) {
        maximum = bins[i]!;
        winner = i;
        tied = false;
      } else if (bins[i] === maximum) tied = true;
    }
    if (tied) return;
    return (
      '#' +
      (
        (((winner >> 8) * 16 + 8) << 16) |
        ((((winner >> 4) & 15) * 16 + 8) << 8) |
        ((winner & 15) * 16 + 8)
      )
        .toString(16)
        .padStart(6, '0')
    );
  };
}

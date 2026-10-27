/** Optimized JS control: sparse resets, cached exact byte quantization, owned string output. */
export function createSparseColourControl() {
  const counts = new Uint16Array(4096),
    touched = new Uint16Array(1024),
    quant = new Uint8Array(256);
  for (let i = 0; i < 256; i++) quant[i] = Math.floor((i * 16) / 257);
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
      throw Error('Invalid bounded RGBA');
    let used = 0,
      maximum = 0,
      winner = 0,
      tied = false;
    for (let i = 0; i < pixels.length; i += 4) {
      const bin =
        (quant[pixels[i]!]! << 8) | (quant[pixels[i + 1]!]! << 4) | quant[pixels[i + 2]!]!;
      if (counts[bin] === 0) touched[used++] = bin;
      const count = ++counts[bin]!;
      if (count > maximum) {
        maximum = count;
        winner = bin;
        tied = false;
      } else if (count === maximum) tied = true;
    }
    for (let i = 0; i < used; i++) counts[touched[i]!] = 0;
    if (tied) return undefined;
    const packed =
      (((winner >> 8) * 16 + 8) << 16) |
      ((((winner >> 4) & 15) * 16 + 8) << 8) |
      ((winner & 15) * 16 + 8);
    return '#' + packed.toString(16).padStart(6, '0');
  };
}

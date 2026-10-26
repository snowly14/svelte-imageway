/** BlurHash base83 and quantization (Wolt BlurHash algorithm, MIT; see NOTICE). */
export function linearToSrgb(value: number): number {
  const v = Math.max(0, Math.min(1, value));
  return v <= 0.0031308
    ? Math.trunc(v * 12.92 * 255 + 0.5)
    : Math.trunc((1.055 * v ** (1 / 2.4) - 0.055) * 255 + 0.5);
}
/** Reuse bounded scratch; toString returns an owned result before the next call. */
function createPacker() {
  const alphabet = Buffer.from(
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~',
  );
  const out = Buffer.alloc(28);
  function write(value: number, length: number, offset: number) {
    for (let i = offset + length - 1; i >= offset; i--) {
      out[i] = alphabet[value % 83]!;
      value = Math.floor(value / 83);
    }
  }
  return function packBlurhash(coefficients: Float64Array): string {
    let maximum = -Infinity;
    for (let i = 3; i < 36; i++) maximum = Math.max(maximum, coefficients[i]!);
    const quantized = Math.floor(Math.max(0, Math.min(82, Math.floor(maximum * 166 - 0.5))));
    const scale = (quantized + 1) / 166;
    out[0] = alphabet[21]!;
    out[1] = alphabet[quantized]!;
    write(
      (linearToSrgb(coefficients[0]!) << 16) +
        (linearToSrgb(coefficients[1]!) << 8) +
        linearToSrgb(coefficients[2]!),
      4,
      2,
    );
    for (let i = 3; i < 36; i += 3) {
      let value = 0;
      for (let c = 0; c < 3; c++) {
        const v = coefficients[i + c]! / scale;
        value =
          value * 19 +
          Math.floor(
            Math.max(
              0,
              Math.min(18, Math.floor((v < 0 ? -1 : 1) * Math.sqrt(Math.abs(v)) * 9 + 9.5)),
            ),
          );
      }
      write(value, 2, 6 + ((i - 3) / 3) * 2);
    }
    return out.toString('ascii');
  };
}

export const packBlurhash = createPacker();

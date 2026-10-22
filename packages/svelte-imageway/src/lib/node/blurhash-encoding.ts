/** BlurHash base83 and quantization (Wolt BlurHash algorithm, MIT; see NOTICE). */
const alphabet =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~';
function base83(value: number, length: number): string {
  let result = '';
  for (let i = length - 1; i >= 0; i--) result += alphabet[Math.floor(value / 83 ** i) % 83];
  return result;
}
function srgb(value: number): number {
  const v = Math.max(0, Math.min(1, value));
  return v <= 0.0031308
    ? Math.trunc(v * 12.92 * 255 + 0.5)
    : Math.trunc((1.055 * v ** (1 / 2.4) - 0.055) * 255 + 0.5);
}
/** Preserve the reference encoder's 4x3 component order and quantization. */
export function packBlurhash(coefficients: Float64Array): string {
  let maximum = -Infinity;
  for (let i = 3; i < 36; i++) maximum = Math.max(maximum, coefficients[i]!);
  const quantized = Math.floor(Math.max(0, Math.min(82, Math.floor(maximum * 166 - 0.5))));
  const scale = (quantized + 1) / 166;
  let result =
    base83(21, 1) +
    base83(quantized, 1) +
    base83(
      (srgb(coefficients[0]!) << 16) + (srgb(coefficients[1]!) << 8) + srgb(coefficients[2]!),
      4,
    );
  for (let i = 3; i < 36; i += 3) {
    let value = 0;
    for (let c = 0; c < 3; c++) {
      const v = coefficients[i + c]! / scale;
      const quantizedChannel = Math.floor(
        Math.max(0, Math.min(18, Math.floor((v < 0 ? -1 : 1) * Math.sqrt(Math.abs(v)) * 9 + 9.5))),
      );
      value = value * 19 + quantizedChannel;
    }
    result += base83(value, 2);
  }
  return result;
}

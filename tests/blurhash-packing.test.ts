import { expect, it } from 'vitest';
import { packBlurhash } from '../packages/svelte-imageway/src/lib/node/blurhash-encoding.js';
import { packBlurhash as reference } from '../bench/native-pack/reference.js';
it('preserves AC boundary rounding, DC extremes and owned strings with cached ASCII packing', () => {
  const coefficients = new Float64Array(36);
  const saved = packBlurhash(coefficients);
  for (let code = 0; code < 256; code++) {
    coefficients.fill(code / 255, 0, 3);
    for (let n = 0; n < 9; n++)
      for (const sign of [-1, 1])
        for (const delta of [-2e-12, 0, 2e-12]) {
          coefficients.fill((sign * (((n + 0.5) / 9) ** 2 + delta)) / 166, 3);
          expect(packBlurhash(coefficients)).toBe(reference(coefficients));
        }
  }
  expect(saved).toBe(reference(new Float64Array(36)));
});

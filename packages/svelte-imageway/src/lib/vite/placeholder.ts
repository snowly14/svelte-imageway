import type { ImageConfig } from '../core/types.js';
import { loadSharp } from '../node/pipeline.js';
import { getBlurhashEncoder } from '../node/blurhash.js';
import { defaults } from '../core/config.js';
import { invariant } from '../core/errors.js';
/** Generate one small display-ready preview per import; none performs no preview decode. */
export async function placeholder(
  data: Uint8Array,
  strategy: ImageConfig['placeholder'],
  limits: Pick<ImageConfig, 'maxPixels' | 'maxInputBytes' | 'timeoutMs'> = defaults,
): Promise<{ placeholder?: string; dominantColor?: string; placeholderHash?: string }> {
  if (strategy === 'none') return {};
  invariant(
    data.byteLength > 0 && data.byteLength <= limits.maxInputBytes,
    'INPUT_SIZE',
    'Preview input exceeds configured byte limit.',
    413,
  );
  const sharp = await loadSharp();
  const [decoded, encoder] = await Promise.all([
    sharp(data, { limitInputPixels: limits.maxPixels })
      .timeout({ seconds: Math.max(1, Math.ceil(limits.timeoutMs / 1000)) })
      .autoOrient()
      .resize({ width: 32, height: 32, fit: 'inside', withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true }),
    getBlurhashEncoder(),
  ]);
  const { data: pixels, info } = decoded;
  const raw = { width: info.width, height: info.height, channels: 4 as const };
  let dominantColor = encoder.dominantColor(pixels, info.width, info.height);
  if (!dominantColor) {
    const { r, g, b } = (await sharp(pixels, { raw }).stats()).dominant;
    dominantColor = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  }
  if (strategy === 'color') return { dominantColor };
  if (strategy === 'lqip') {
    const small = await sharp(pixels, { raw })
      .resize({ width: 12, height: 12, fit: 'inside' })
      .webp({ quality: 20 })
      .toBuffer();
    return { dominantColor, placeholder: `data:image/webp;base64,${small.toString('base64')}` };
  }
  if (strategy === 'thumbhash') {
    const { rgbaToThumbHash, thumbHashToDataURL } = await import('thumbhash');
    const hash = rgbaToThumbHash(info.width, info.height, pixels);
    return {
      dominantColor,
      placeholderHash: Buffer.from(hash).toString('base64'),
      placeholder: thumbHashToDataURL(hash),
    };
  }
  const { decode } = await import('blurhash');
  const hash = encoder.encode(pixels, info.width, info.height);
  const preview = await sharp(Buffer.from(decode(hash, 16, 16)), {
    raw: { width: 16, height: 16, channels: 4 },
  })
    .webp({ quality: 20 })
    .toBuffer();
  return {
    dominantColor,
    placeholderHash: hash,
    placeholder: `data:image/webp;base64,${preview.toString('base64')}`,
  };
}

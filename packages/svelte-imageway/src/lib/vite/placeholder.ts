import type { ImageConfig } from '../core/types.js';
import { loadSharp } from '../node/pipeline.js';

/** Generate display-ready previews on the server; browser decoders are unnecessary. */
export async function placeholder(data: Uint8Array, strategy: ImageConfig['placeholder']): Promise<{ placeholder?: string; dominantColor: string; placeholderHash?: string }> {
  const sharp = await loadSharp();
  const image = sharp(data, { limitInputPixels: 40_000_000 }).autoOrient();
  const { r, g, b } = (await image.clone().stats()).dominant;
  const dominantColor = `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
  if (strategy === 'none' || strategy === 'color') return { dominantColor };
  if (strategy === 'lqip') {
    const small = await image.resize({ width: 12, height: 12, fit: 'inside' }).webp({ quality: 20 }).toBuffer();
    return { dominantColor, placeholder: `data:image/webp;base64,${small.toString('base64')}` };
  }
  const { data: pixels, info } = await image.resize({ width: 32, height: 32, fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (strategy === 'thumbhash') {
    const { rgbaToThumbHash, thumbHashToDataURL } = await import('thumbhash');
    const hash = rgbaToThumbHash(info.width, info.height, pixels);
    return { dominantColor, placeholderHash: Buffer.from(hash).toString('base64'), placeholder: thumbHashToDataURL(hash) };
  }
  const { encode, decode } = await import('blurhash');
  const hash = encode(new Uint8ClampedArray(pixels), info.width, info.height, 4, 3);
  const preview = await sharp(Buffer.from(decode(hash, 16, 16)), { raw: { width: 16, height: 16, channels: 4 } }).webp({ quality: 20 }).toBuffer();
  return { dominantColor, placeholderHash: hash, placeholder: `data:image/webp;base64,${preview.toString('base64')}` };
}

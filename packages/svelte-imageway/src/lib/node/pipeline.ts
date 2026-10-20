import { validateSvg } from './svg.js';
import type Sharp from 'sharp';
import { defaults } from '../core/config.js';
import { ImagewayError, invariant } from '../core/errors.js';
import type { ImageConfig, NormalizedRequest, OutputFormat } from '../core/types.js';

let factory: typeof Sharp | undefined;
/** Load Sharp only on a Node/build transformation path. */
export async function loadSharp(): Promise<typeof Sharp> {
  if (factory) return factory;
  try {
    factory = (await import('sharp')).default;
    return factory;
  } catch {
    throw new ImagewayError(
      'SHARP_MISSING',
      'Install sharp with bun add sharp, or configure a native/remote image provider for this runtime.',
      500,
    );
  }
}
/** Recognize permitted container signatures before decoder invocation. SVG is never trusted raw. */
export function sniff(data: Uint8Array): string {
  const b = Buffer.from(data);
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
  if (/^GIF8[79]a$/.test(b.toString('ascii', 0, 6))) return 'gif';
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (
    b.toString('ascii', 4, 8) === 'ftyp' &&
    /(avif|avis|heic|heix|mif1)/.test(b.toString('ascii', 8, 32))
  )
    return 'heif';
  if (['49492a00', '4d4d002a'].includes(b.subarray(0, 4).toString('hex'))) return 'tiff';
  if (
    b.subarray(0, 2).toString('hex') === 'ff0a' ||
    b.subarray(0, 12).toString('hex') === '0000000c4a584c200d0a870a'
  )
    return 'jxl';
  const text = b.toString('utf8').trimStart();
  if (/^(?:<\?xml[^>]*>\s*)?<svg[\s>]/i.test(text)) {
    validateSvg(text);
    return 'svg';
  }
  throw new ImagewayError(
    'INPUT_TYPE',
    'Unsupported image signature. Supported codecs depend on the installed Sharp/libvips build.',
    415,
  );
}
export interface TransformResult {
  data: Buffer;
  width: number;
  height: number;
  format: OutputFormat;
  dominantColor: string;
  placeholder: string;
}
/** Enforce decoder/resource policies and encode one explicit representation. */
export async function transform(
  data: Uint8Array,
  request: NormalizedRequest,
  format: OutputFormat,
  config: ImageConfig = defaults,
  includePreview = true,
): Promise<TransformResult> {
  invariant(
    data.length > 0 && data.length <= config.maxInputBytes,
    'INPUT_SIZE',
    'Input exceeds configured byte limit.',
    413,
  );
  const kind = sniff(data);
  invariant(
    format !== 'svg',
    'OUTPUT_TYPE',
    'Raw SVG output is disabled; request a raster format.',
    415,
  );
  const sharp = await loadSharp();
  try {
    const options = {
      limitInputPixels: config.maxPixels,
      failOn: 'warning' as const,
      animated: request.animation === 'preserve',
    };
    const metadata = await sharp(data, options).metadata();
    const frames = metadata.pages ?? 1;
    invariant(
      (metadata.width ?? 0) * (metadata.pageHeight ?? metadata.height ?? 0) * frames <=
        config.maxPixels && frames <= 100,
      'PIXEL_LIMIT',
      'Decoded pixels or frame count exceed limits.',
      413,
    );
    invariant(
      !(frames > 1 && request.animation === 'preserve' && !['gif', 'webp'].includes(format)),
      'ANIMATION',
      'This encoder does not preserve animation; select WebP/GIF or animation=first.',
      422,
    );
    const position = {
      'top-left': 'northwest',
      'top-right': 'northeast',
      'bottom-left': 'southwest',
      'bottom-right': 'southeast',
      top: 'north',
      bottom: 'south',
      left: 'west',
      right: 'east',
      center: 'centre',
      attention: 'attention',
      entropy: 'entropy',
    }[request.position];
    let image = sharp(data, options).autoOrient();
    if (request.rotate) image = image.rotate(request.rotate);
    if (request.flip === 'horizontal' || request.flip === 'both') image = image.flop();
    if (request.flip === 'vertical' || request.flip === 'both') image = image.flip();
    const fit = request.fit === 'scale-down' ? 'inside' : request.fit;
    if (request.w || request.h)
      image = image.resize({
        width: request.w ? Math.round(request.w * request.dpr) : undefined,
        height: request.h ? Math.round(request.h * request.dpr) : undefined,
        fit,
        position,
        withoutEnlargement: true,
        background:
          request.bg === 'transparent' || !request.bg
            ? { r: 0, g: 0, b: 0, alpha: 0 }
            : `#${request.bg}`,
      });
    if (request.blur) image = image.blur(Math.max(0.3, request.blur));
    if (request.sharpen) image = image.sharpen({ sigma: request.sharpen });
    if (request.metadata === 'icc' || request.metadata === 'safe') image = image.keepIccProfile();
    image = image.timeout({ seconds: Math.max(1, Math.ceil(config.timeoutMs / 1000)) });
    const preview = image.clone();
    const encoded = image.toFormat(
      format,
      format === 'jpeg' ? { quality: request.q, mozjpeg: true } : { quality: request.q },
    );
    const output = await encoded.toBuffer({ resolveWithObject: true });
    invariant(
      output.data.length <= config.maxOutputBytes,
      'OUTPUT_SIZE',
      'Encoded output exceeds configured byte limit.',
      413,
    );
    if (!includePreview)
      return {
        data: output.data,
        width: output.info.width,
        height: output.info.pageHeight ?? output.info.height,
        format,
        dominantColor: '',
        placeholder: '',
      };
    const stats = await preview.clone().stats();
    const { r, g, b } = stats.dominant;
    const dominantColor = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
    const lqip = await preview
      .clone()
      .resize({ width: 12, height: 12, fit: 'inside' })
      .webp({ quality: 20 })
      .toBuffer();
    invariant(lqip.length < 1024, 'PLACEHOLDER_SIZE', 'Placeholder exceeds the 1KB budget.', 413);
    void kind;
    return {
      data: output.data,
      width: output.info.width,
      height: output.info.pageHeight ?? output.info.height,
      format,
      dominantColor,
      placeholder: `data:image/webp;base64,${lqip.toString('base64')}`,
    };
  } catch (error) {
    if (error instanceof ImagewayError) throw error;
    throw new ImagewayError(
      'DECODE',
      'Image could not be decoded/encoded within configured limits. Check the installed Sharp codec capabilities.',
      415,
    );
  }
}
/** Report real decoder/encoder availability rather than promising exotic formats. */
export async function codecCapabilities(): Promise<unknown> {
  const sharp = await loadSharp();
  return { versions: sharp.versions, formats: sharp.format };
}

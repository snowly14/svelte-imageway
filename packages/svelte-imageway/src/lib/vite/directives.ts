import { defaults } from '../core/config.js';
import { invariant } from '../core/errors.js';
import type { ImageConfig, ImageRequest, OutputFormat } from '../core/types.js';

export interface ImageDirectives { widths: number[]; formats: OutputFormat[]; quality: number; placeholder: ImageConfig['placeholder']; transforms: ImageRequest }
/** Parse bounded import directives. Build widths are exact, unlike dynamic URL buckets. */
export function parseDirectives(query: string, width: number, config: ImageConfig = defaults): ImageDirectives {
  const params = new URLSearchParams(query);
  const seen = new Set<string>();
  for (const [key] of params) {
    invariant(!seen.has(key) && ['img', 'w', 'h', 'format', 'q', 'fit', 'position', 'placeholder', 'animation', 'metadata', 't', 'v', 'import'].includes(key), 'DIRECTIVE', `Unknown or duplicate image directive: ${key}.`); seen.add(key);
  }
  const widths = params.has('w') ? params.get('w')!.split(';').map(Number) : [...config.widths.filter(v => v < width), Math.min(width, config.widths.at(-1)!)];
  invariant(widths.length > 0 && widths.length <= 16 && widths.every(v => Number.isSafeInteger(v) && v > 0 && v <= config.maxDimension), 'DIRECTIVE', 'Import widths must be 1–16 positive bounded integers.');
  const formats = params.get('format')?.split(';').map(v => v === 'jpg' ? 'jpeg' : v) ?? [...config.formats];
  invariant(formats.length > 0 && formats.length <= 6 && formats.every(v => ['avif', 'webp', 'jpeg', 'png', 'gif', 'svg'].includes(v)), 'DIRECTIVE', 'Unsupported import format.');
  invariant(widths.length * formats.length <= 64, 'DIRECTIVE', 'An import may generate at most 64 variants.');
  const quality = params.has('q') ? Number(params.get('q')) : config.quality;
  invariant(Number.isInteger(quality) && quality >= 1 && quality <= 100, 'DIRECTIVE', 'Import quality must be 1–100.');
  const placeholder = params.get('placeholder') ?? config.placeholder;
  invariant(['lqip', 'none', 'color', 'thumbhash', 'blurhash'].includes(placeholder), 'DIRECTIVE', 'Unsupported placeholder.');
  const transforms: ImageRequest = {};
  for (const key of ['h', 'fit', 'position', 'animation', 'metadata'] as const) if (params.has(key)) Object.assign(transforms, { [key]: key === 'h' ? Number(params.get(key)) : params.get(key) });
  return { widths: [...new Set(widths.map(v => Math.min(v, width)))].sort((a, b) => a - b), formats: [...new Set(formats)] as OutputFormat[], quality, placeholder: placeholder as ImageConfig['placeholder'], transforms };
}

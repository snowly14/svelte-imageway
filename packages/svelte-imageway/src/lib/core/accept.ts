import { ImagewayError } from './errors.js';
import type { OutputFormat } from './types.js';

/** Negotiate a supported representation, respecting explicit q=0 exclusions. */
export function negotiateFormat(accept: string | null, supported: readonly OutputFormat[] = ['avif', 'webp', 'jpeg']): OutputFormat {
  const entries = (accept || '*/*').split(',').map((item, index) => {
    const [mime = '', ...params] = item.trim().toLowerCase().split(';');
    const quality = params.find(p => p.trim().startsWith('q='))?.trim().slice(2);
    const q = quality === undefined ? 1 : Number(quality);
    return { mime: mime.trim(), q: Number.isFinite(q) && q >= 0 && q <= 1 ? q : 0, index };
  });
  const candidates = supported.map((format, index) => {
    const mime = mimeType(format);
    const matches = entries.filter(v => v.mime === mime || v.mime === 'image/*' || v.mime === '*/*').sort((a, b) => specificity(b.mime) - specificity(a.mime) || a.index - b.index);
    return { format, q: matches[0]?.q ?? 0, index };
  }).filter(v => v.q > 0).sort((a, b) => b.q - a.q || a.index - b.index);
  if (!candidates[0]) throw new ImagewayError('ACCEPT', 'No acceptable supported image format.', 406);
  return candidates[0].format;
}
function specificity(mime: string): number { return mime === '*/*' ? 0 : mime === 'image/*' ? 1 : 2; }
/** Correct response/source MIME for each explicit format. */
export function mimeType(format: OutputFormat): string { return format === 'svg' ? 'image/svg+xml' : `image/${format}`; }

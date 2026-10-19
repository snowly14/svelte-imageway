import type { ImageArtifact } from './core/types.js';
/** Escape URLs for a quoted CSS string, including HTML raw-text delimiters. */
export function cssUrl(src: string): string { return `url("${src.replace(/[\\"\n\r<>]/g, c => `\\${c.charCodeAt(0).toString(16)} `)}")`; }
/** Native image-set with an ordinary URL fallback; responsive widths map into densities. */
export function backgroundStyle(src: ImageArtifact | string): string {
  if (typeof src === 'string') return `background-image:${cssUrl(src)}`;
  const variants = [ ...src.sources.flatMap(source => source.srcset.split(',').map(v => ({ value: v.trim(), type: source.type }))), ...src.srcset.split(',').map(v => ({ value: v.trim(), type: undefined })) ];
  const candidates = variants.map(({ value, type }) => {
    const match = value.match(/^(.*)\s+(\d+)w$/); if (!match) return '';
    return `${cssUrl(match[1]!)} ${Number(match[2]) / src.width}x${type ? ` type("${type.replace(/[^\w/+.-]/g, '')}")` : ''}`;
  }).filter(Boolean).join(',');
  return `background-image:${cssUrl(src.src)};background-image:image-set(${candidates})`;
}

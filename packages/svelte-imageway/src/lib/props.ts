import type { HTMLImgAttributes } from 'svelte/elements';
import type { ImageArtifact, ImageProvider, ImageSource, Fit, Position } from './core/types.js';
import { invariant } from './core/errors.js';

/** Public browser configuration; intentionally contains no private server fields. */
export interface ImageContextConfig {
  provider?: ImageProvider;
  providers?: Readonly<Record<string, ImageProvider>>;
  widths?: readonly number[];
  quality?: number;
}
/** Headless input shared by components and custom image presentation. */
export interface ImageOptions extends Omit<HTMLImgAttributes, 'src' | 'alt' | 'width' | 'height' | 'class' | 'style' | 'placeholder'> {
  src: ImageArtifact | string;
  alt: string;
  width?: number;
  height?: number;
  priority?: boolean;
  fit?: Fit;
  position?: Position;
  placeholder?: string | false;
  quality?: number;
  provider?: ImageProvider;
  config?: ImageContextConfig;
  class?: string;
  style?: string;
  transitionName?: string;
  contentVisibility?: 'auto' | 'visible';
}
/** Expand shorthand such as "sm:100vw md:50vw lg:33vw" into valid HTML sizes. */
export function imageSizes(sizes = '100vw', lazy = true): string {
  if (sizes.startsWith('auto') && !lazy) return sizes.replace(/^auto\s*,?\s*/, '') || '100vw';
  if (!/\b(?:sm|md|lg|xl):/.test(sizes)) return sizes;
  const breakpoints: Record<string, number> = { sm: 640, md: 768, lg: 1024, xl: 1280 };
  return sizes.trim().split(/\s+/).reverse().map(token => { const [name, value] = token.split(':'); return value && breakpoints[name!] ? `(min-width: ${breakpoints[name!]}px) ${value}` : token; }).join(', ') + ', 100vw';
}
/** Compute native attributes without touching browser globals. */
export function getImageProps(options: ImageOptions): HTMLImgAttributes & { sources: ImageSource[]; placeholder?: string } {
  invariant(typeof options.alt === 'string', 'ALT', 'Image alt is required; use alt="" for decorative images.');
  const { src, alt, priority, provider: explicit, config = {}, fit = 'inside', position = 'center', quality, placeholder, transitionName, contentVisibility, class: className, style: customStyle, ...native } = options;
  const artifact = typeof src === 'string' ? undefined : src;
  const original = artifact?.src ?? src as string;
  const provider = explicit ?? selectProvider(original, config);
  let fallback = original; let srcset = artifact?.srcset; let sources = artifact?.sources ?? [];
  const width = options.width ?? artifact?.width, height = options.height ?? artifact?.height;
  if (provider && !artifact) {
    provider.validate();
    const widths = [...new Set([...(config.widths ?? [320, 640, 960, 1280, 1920]).filter(v => !width || v < width), width ?? 1920])].sort((a, b) => a - b);
    const source = original.startsWith('/') ? { key: original.slice(1) } : { url: original };
    const request = { ...source, fit, position, q: quality ?? config.quality ?? 75 };
    const formats = provider.capabilities.formats.filter(v => ['avif', 'webp', 'jpeg', 'png'].includes(v));
    const fallbackFormat = formats.includes('jpeg') ? 'jpeg' : formats.at(-1);
    const srcsetFor = (format: typeof fallbackFormat) => widths.map(w => `${provider.buildUrl({ ...request, w, format })} ${w}w`).join(', ');
    fallback = provider.buildUrl({ ...request, w: width ?? 1920, format: fallbackFormat });
    srcset = srcsetFor(fallbackFormat);
    sources = formats.filter(v => v !== fallbackFormat).map(format => ({ type: `image/${format}`, srcset: srcsetFor(format) }));
  }
  const lazy = !priority && options.loading !== 'eager';
  const disabled = placeholder === false || placeholder === 'none';
  const preview = disabled || placeholder === 'color' ? undefined : placeholder && !['lqip', 'thumbhash', 'blurhash'].includes(placeholder) ? placeholder : artifact?.placeholder;
  const safePreview = preview && /^data:image\/(?:webp|png|jpeg);base64,[a-zA-Z0-9+/]+=*$/.test(preview) ? preview : undefined;
  const color = disabled ? 'transparent' : artifact?.dominantColor && /^#[a-f\d]{6,8}$/i.test(artifact.dominantColor) ? artifact.dominantColor : 'transparent';
  const cssFit = fit === 'inside' ? 'contain' : fit === 'outside' ? 'cover' : fit;
  const cssPosition = ['entropy', 'attention'].includes(position) ? 'center' : position.replace('-', ' ');
  const style = [`max-width:100%;height:auto;object-fit:${cssFit};object-position:${cssPosition}`, width && height ? `aspect-ratio:${width}/${height}` : '', `background-color:${color}`, safePreview ? `background-image:url("${safePreview}");background-size:cover` : '', transitionName && /^[a-zA-Z_][\w-]*$/.test(transitionName) ? `view-transition-name:${transitionName}` : '', contentVisibility ? `content-visibility:${contentVisibility}` : '', customStyle].filter(Boolean).join(';');
  return { ...native, src: fallback, srcset, sources, alt, width, height, sizes: srcset ? imageSizes(options.sizes ?? undefined, lazy) : undefined, loading: priority ? 'eager' : options.loading ?? 'lazy', decoding: priority ? 'sync' : options.decoding ?? 'async', fetchpriority: priority ? 'high' : options.fetchpriority ?? 'auto', class: className, style, placeholder: safePreview };
}
function selectProvider(src: string, config: ImageContextConfig): ImageProvider | undefined {
  let hostname: string | undefined;
  try { hostname = new URL(src).hostname; } catch { /* Local keys use the wildcard provider. */ }
  return (hostname ? config.providers?.[hostname] : undefined) ?? config.providers?.['*'] ?? config.provider;
}

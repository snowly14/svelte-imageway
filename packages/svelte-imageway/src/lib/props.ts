import type { HTMLImgAttributes } from 'svelte/elements';
import type {
  ImageArtifact,
  ImageProvider,
  ImageSource,
  Fit,
  Position,
  OutputFormat,
} from './core/types.js';
import { invariant } from './core/errors.js';
import { resolveImageArtifact } from './core/artifact.js';

/** Public browser configuration; intentionally contains no private server fields. */
export interface ImageContextConfig {
  /** Auto uses server negotiation where supported; picture forces explicit sources. */
  formatStrategy?: 'auto' | 'picture' | 'img';
  provider?: ImageProvider;
  providers?: Readonly<Record<string, ImageProvider>>;
  widths?: readonly number[];
  quality?: number;
  formats?: readonly OutputFormat[];
}
/** Headless input shared by components and custom image presentation. */
export interface ImageOptions extends Omit<
  HTMLImgAttributes,
  'src' | 'alt' | 'width' | 'height' | 'class' | 'style' | 'placeholder'
> {
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
  formatStrategy?: 'auto' | 'picture' | 'img';
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
  return (
    sizes
      .trim()
      .split(/\s+/)
      .reverse()
      .map((token) => {
        const [name, value] = token.split(':');
        return value && breakpoints[name!]
          ? `(min-width: ${breakpoints[name!]}px) ${value}`
          : token;
      })
      .join(', ') + ', 100vw'
  );
}
/** Compute native attributes without touching browser globals. */
export function getImageProps(
  options: ImageOptions,
): HTMLImgAttributes & { sources: ImageSource[]; placeholder?: string } {
  invariant(
    typeof options.alt === 'string',
    'ALT',
    'Image alt is required; use alt="" for decorative images.',
  );
  const {
    src,
    priority,
    provider: explicit,
    config = {},
    fit = 'inside',
    position = 'center',
    quality,
    formatStrategy,
    placeholder,
    transitionName,
    contentVisibility,
    ...native
  } = options;
  const strategy = formatStrategy ?? config.formatStrategy ?? 'auto';
  const nativeOnly = strategy === 'img';
  const artifact = resolveImageArtifact(src);
  const representation = nativeOnly ? (artifact?.img ?? artifact) : artifact;
  const original = representation?.src ?? (src as string);
  const provider = !artifact && (explicit ?? selectProvider(original, config));
  let fallback = original;
  let srcset = representation?.srcset;
  let sources = nativeOnly ? [] : (artifact?.sources ?? []);
  const width = native.width ?? representation?.width,
    height = native.height ?? representation?.height;
  if (provider && !original.startsWith('data:')) {
    provider.validate();
    const widths = [
      ...new Set([
        ...(config.widths ?? [320, 640, 960, 1280, 1920]).filter((v) => !width || v < width),
        width ?? 1920,
      ]),
    ].sort((a, b) => a - b);
    const source =
      original.startsWith('/') || !/^[a-z]+:/i.test(original)
        ? { key: original.replace(/^\//, '') }
        : { url: original };
    if (provider.capabilities.fixed) {
      fallback = provider.buildUrl(source);
      srcset = undefined;
      sources = [];
    } else {
      const request = { ...source, fit, position, q: quality ?? config.quality ?? 75 };
      const formats =
        provider.capabilities.explicitFormat === false ||
        (strategy !== 'picture' && provider.capabilities.autoFormat === true && !config.formats)
          ? []
          : provider.capabilities.formats.filter(
              (v) =>
                ['avif', 'webp', 'jpeg', 'png'].includes(v) &&
                (!config.formats || config.formats.includes(v)) &&
                (!provider.capabilities.maxWidthByFormat?.[v] ||
                  Math.max(...widths) <= provider.capabilities.maxWidthByFormat[v]!),
            );
      const fallbackFormat =
        nativeOnly && formats.includes('webp')
          ? 'webp'
          : formats.includes('jpeg')
            ? 'jpeg'
            : formats.at(-1);
      const srcsetFor = (format: OutputFormat | 'auto') =>
        widths.map((w) => `${provider.buildUrl({ ...request, w, format })} ${w}w`).join(', ');
      fallback = provider.buildUrl({
        ...request,
        w: width ?? 1920,
        format: fallbackFormat ?? 'auto',
      });
      srcset = srcsetFor(fallbackFormat ?? 'auto');
      sources = (nativeOnly ? [] : formats)
        .filter((v) => v !== fallbackFormat)
        .map((format) => ({ type: `image/${format}`, srcset: srcsetFor(format) }));
    }
  }
  const lazy = !priority && options.loading !== 'eager';
  const disabled = placeholder === false || placeholder === 'none';
  const preview =
    disabled || placeholder === 'color'
      ? undefined
      : placeholder && !['lqip', 'thumbhash', 'blurhash'].includes(placeholder)
        ? placeholder
        : artifact?.placeholder;
  const safePreview =
    preview && /^data:image\/(?:webp|png|jpeg);base64,[a-zA-Z0-9+/]+=*$/.test(preview)
      ? preview
      : undefined;
  const color = disabled
    ? 'transparent'
    : artifact?.dominantColor && /^#[a-f\d]{6,8}$/i.test(artifact.dominantColor)
      ? artifact.dominantColor
      : 'transparent';
  const cssFit = fit === 'inside' ? 'contain' : fit === 'outside' ? 'cover' : fit;
  const cssPosition = ['entropy', 'attention'].includes(position)
    ? 'center'
    : position.replace('-', ' ');
  const style = [
    `max-width:100%;height:auto;object-fit:${cssFit};object-position:${cssPosition}`,
    width && height ? `aspect-ratio:${width}/${height}` : '',
    `background-color:${color}`,
    safePreview ? `background-image:url("${safePreview}");background-size:cover` : '',
    transitionName && /^[a-zA-Z_][\w-]*$/.test(transitionName)
      ? `view-transition-name:${transitionName}`
      : '',
    contentVisibility ? `content-visibility:${contentVisibility}` : '',
    native.style,
  ]
    .filter(Boolean)
    .join(';');
  return {
    ...native,
    src: fallback,
    srcset,
    sources,
    width,
    height,
    sizes: srcset ? imageSizes(options.sizes ?? undefined, lazy) : undefined,
    loading: priority ? 'eager' : (options.loading ?? 'lazy'),
    decoding: priority ? 'sync' : (options.decoding ?? 'async'),
    fetchpriority: priority ? 'high' : (options.fetchpriority ?? 'auto'),
    style,
    placeholder: safePreview,
  };
}
function selectProvider(src: string, config: ImageContextConfig): ImageProvider | undefined {
  const providers = config.providers;
  if (!providers) return config.provider;
  let hostname: string | undefined;
  try {
    hostname = new URL(src).hostname;
  } catch {
    /* Local keys use the wildcard provider. */
  }
  return (
    (hostname && Object.hasOwn(providers, hostname) ? providers[hostname] : undefined) ??
    providers['*'] ??
    config.provider
  );
}

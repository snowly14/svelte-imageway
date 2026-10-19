import { provider, rasterCapabilities, baseUrl, source, dimensions } from './shared.js';
import { invariant } from '../core/errors.js';
/** Vercel negotiates formats; configure sizes/origins/formats in its adapter/Build Output API. */
export function vercel(options: { base?: string } = {}) {
  return provider(
    'vercel',
    {
      ...rasterCapabilities,
      fit: ['inside'],
      smartCrop: false,
      animation: false,
      explicitFormat: false,
    },
    (r) => {
      invariant(
        !r.h && r.format === 'auto',
        'CAPABILITY',
        'Vercel supports width/quality and native format negotiation only.',
        422,
      );
      return `${baseUrl(options.base)}/_vercel/image?${new URLSearchParams({ url: source(r), ...dimensions(r), q: String(r.q) })}`;
    },
    { factory: 'vercel', options: { ...options } },
  );
}

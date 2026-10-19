import { provider, dimensions, source } from './shared.js';
import { basic, centered, endpoint } from './url-tools.js';
import { invariant } from '../core/errors.js';
/** Explicit unsafe mode is for a private proxy behind a signed Imageway endpoint. Never expose an open optimizer. */
export function imgproxy(options: { base: string; allowUnsigned: boolean }) {
  invariant(
    options.allowUnsigned,
    'SIGNATURE',
    'imgproxy requires server-signed URLs; allowUnsigned is only for a private protected origin.',
  );
  const base = endpoint(options.base).href.replace(/\/$/, '');
  return provider(
    'imgproxy',
    { ...basic, formats: ['avif', 'webp', 'jpeg', 'png'], fit: ['inside', 'cover'] },
    (r) => {
      centered(r);
      const d = dimensions(r);
      return `${base}/unsafe/rs:${r.fit === 'cover' ? 'fill' : 'fit'}:${d.w ?? 0}:${d.h ?? 0}:0/q:${r.q}/plain/${encodeURIComponent(source(r))}${r.format === 'auto' ? '' : '@' + r.format}`;
    },
    { factory: 'imgproxy', options },
  );
}

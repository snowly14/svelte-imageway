import { provider, dimensions } from './shared.js';
import { asset, basic, centered, query, format } from './url-tools.js';
import { invariant } from '../core/errors.js';
/** Public unsigned imgix source. Signed imgix URLs must be signed after transformation on the server. */
export function imgix(options: { base: string }) {
  return provider(
    'imgix',
    {
      ...basic,
      formats: ['avif', 'webp', 'jpeg', 'png'],
      fit: ['inside', 'cover', 'fill', 'contain'],
    },
    (r) => {
      centered(r);
      const u = asset(options.base, r);
      invariant(
        !u.searchParams.has('s'),
        'SIGNED_SOURCE',
        'Do not modify signed imgix URLs; re-sign server-side.',
      );
      return query(u, {
        ...dimensions(r),
        q: r.q,
        fit: {
          inside: 'max',
          cover: 'crop',
          fill: 'scale',
          contain: 'fill',
          outside: '',
          'scale-down': '',
        }[r.fit],
        fm: r.format === 'auto' ? undefined : format(r),
        auto: r.format === 'auto' ? 'format' : undefined,
      });
    },
    { factory: 'imgix', options },
  );
}

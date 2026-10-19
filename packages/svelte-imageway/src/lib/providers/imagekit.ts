import { provider, dimensions } from './shared.js';
import { asset, basic, centered, query, format } from './url-tools.js';
import { invariant } from '../core/errors.js';
export function imagekit(options: { base: string }) {
  return provider(
    'imagekit',
    basic,
    (r) => {
      centered(r);
      const u = asset(options.base, r);
      invariant(
        !u.searchParams.has('ik-s'),
        'SIGNED_SOURCE',
        'Re-sign ImageKit URLs server-side after transformation.',
      );
      const d = dimensions(r);
      return query(u, {
        tr: [d.w && `w-${d.w}`, d.h && `h-${d.h}`, 'c-at_max', `q-${r.q}`, `f-${format(r)}`]
          .filter(Boolean)
          .join(','),
      });
    },
    { factory: 'imagekit', options },
  );
}

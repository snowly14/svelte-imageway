import { provider, dimensions } from './shared.js';
import { asset, basic, centered, format } from './url-tools.js';
import { invariant } from '../core/errors.js';
export function uploadcare(options: { base: string }) {
  return provider(
    'uploadcare',
    basic,
    (r) => {
      centered(r);
      const u = asset(options.base, r);
      invariant(
        !u.search && !u.pathname.includes('/-/'),
        'SOURCE',
        'Pass an unmodified public Uploadcare asset.',
      );
      const d = dimensions(r);
      return `${u.href.replace(/\/$/, '')}/-/preview/${d.w ?? 2048}x${d.h ?? 2048}/-/quality/${r.q <= 50 ? 'lightest' : r.q <= 65 ? 'lighter' : r.q <= 75 ? 'normal' : r.q <= 85 ? 'better' : 'best'}/-/format/${r.format === 'jpeg' ? 'jpeg' : format(r)}/`;
    },
    { factory: 'uploadcare', options },
  );
}

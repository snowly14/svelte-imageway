import { provider, dimensions } from './shared.js';
import { asset, basic, centered, query } from './url-tools.js';
import { invariant } from '../core/errors.js';
/** Public bucket only. Signed render tokens bind transformations and must be generated server-side. */
export function supabase(options: { base: string; bucket: string }) {
  invariant(/^[\w-]+$/.test(options.bucket), 'PROVIDER', 'Invalid public bucket.');
  return provider(
    'supabase',
    { ...basic, explicitFormat: false, fit: ['inside', 'cover', 'fill'] },
    (r) => {
      centered(r);
      invariant(
        r.format === 'auto',
        'CAPABILITY',
        'Supabase negotiates output format; use auto.',
        422,
      );
      const u = asset(options.base + '/storage/v1/object/public/' + options.bucket, r);
      u.pathname = u.pathname.replace('/object/public/', '/render/image/public/');
      const d = dimensions(r);
      return query(u, {
        width: d.w,
        height: d.h,
        quality: r.q,
        resize: r.fit === 'inside' ? 'contain' : r.fit,
      });
    },
    { factory: 'supabase', options },
  );
}

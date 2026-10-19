import { provider, dimensions } from './shared.js';
import { asset, basic, centered, query, format } from './url-tools.js';
/** Bunny Optimizer must be enabled on this Pull Zone. */
export function bunny(options: { base: string }) {
  return provider(
    'bunny',
    basic,
    (r) => {
      centered(r);
      const d = dimensions(r);
      return query(asset(options.base, r), {
        width: d.w,
        height: d.h,
        quality: r.q,
        format: r.format === 'auto' ? undefined : format(r),
      });
    },
    { factory: 'bunny', options },
  );
}

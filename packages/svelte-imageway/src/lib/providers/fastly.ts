import { provider, dimensions } from './shared.js';
import { asset, basic, centered, query } from './url-tools.js';
export function fastly(options: { base: string }) {
  return provider(
    'fastly',
    { ...basic, explicitFormat: false },
    (r) => {
      centered(r);
      const d = dimensions(r);
      return query(asset(options.base, r), {
        width: d.w,
        height: d.h,
        fit: 'bounds',
        quality: r.q,
        format: r.format === 'auto' ? 'auto' : r.format === 'jpeg' ? 'pjpg' : r.format,
      });
    },
    { factory: 'fastly', options },
  );
}

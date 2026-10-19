import { provider, dimensions, source, baseUrl } from './shared.js';
import { basic, centered } from './url-tools.js';
export function ipx(options: { base?: string } = {}) {
  const base = baseUrl(options.base ?? '/_ipx');
  return provider(
    'ipx',
    { ...basic, formats: ['avif', 'webp', 'jpeg', 'png'] },
    (r) => {
      centered(r);
      const d = dimensions(r);
      const mods = [
        d.w && `w_${d.w}`,
        d.h && `h_${d.h}`,
        `q_${r.q}`,
        r.format !== 'auto' && `f_${r.format}`,
      ]
        .filter(Boolean)
        .join(',');
      return `${base}/${mods}/${encodeURIComponent(source(r).replace(/^\//, ''))}`;
    },
    { factory: 'ipx', options },
  );
}

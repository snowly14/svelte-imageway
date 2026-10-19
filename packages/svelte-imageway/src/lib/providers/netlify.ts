import { provider, rasterCapabilities, baseUrl, source, dimensions } from './shared.js';
import { invariant } from '../core/errors.js';
/** Native Netlify Image CDN; remote sources must match netlify.toml remote_images. */
export function netlify(options: { base?: string } = {}) {
  return provider('netlify', { ...rasterCapabilities, formats: ['avif', 'webp', 'jpeg', 'png', 'gif'], fit: ['inside', 'cover', 'fill'], smartCrop: false }, r => {
    invariant(['center', 'top', 'bottom', 'left', 'right'].includes(r.position), 'CAPABILITY', 'Netlify supports cardinal crop positions only.', 422);
    return `${baseUrl(options.base)}/.netlify/images?${new URLSearchParams({ url: source(r), ...dimensions(r), q: String(r.q), fit: r.fit === 'inside' ? 'contain' : r.fit, position: r.position, ...(r.format === 'auto' ? {} : { fm: r.format === 'jpeg' ? 'jpg' : r.format }) })}`;
  }, { factory: 'netlify', options: { ...options } });
}

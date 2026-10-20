import { imageUrl } from '../core/url.js';
import { defineConfig } from '../core/config.js';
import { provider, rasterCapabilities, baseUrl } from './shared.js';
/** Use the v1 service. A locked card preset bounds unsigned requests by default. */
export function edge(options: { base?: string; endpoint?: string; preset?: string } = {}) {
  const base = baseUrl(options.base);
  const config = defineConfig({ endpoint: options.endpoint ?? '/_img/v1' });
  return provider(
    'edge',
    { ...rasterCapabilities, signature: true, autoFormat: true },
    (r) => base + imageUrl({ ...r, preset: r.preset ?? options.preset ?? 'card' }, config),
    { factory: 'edge', options: { ...options } },
    [
      'w',
      'h',
      'dpr',
      'q',
      'format',
      'fit',
      'position',
      'blur',
      'sharpen',
      'bg',
      'rotate',
      'flip',
      'metadata',
      'animation',
      'sig',
    ],
  );
}

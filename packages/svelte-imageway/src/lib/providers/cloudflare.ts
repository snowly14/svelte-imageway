import { provider, rasterCapabilities, baseUrl, source, dimensions } from './shared.js';
import { invariant } from '../core/errors.js';
import { edge } from './edge.js';
export interface CloudflareOptions { base?: string; mode?: 'url' | 'worker' | 'hosted'; accountHash?: string; variant?: string }
/** Zone transformations, hosted delivery, or the Worker v1 endpoint (binding/cf.image). */
export function cloudflare(options: CloudflareOptions = {}) {
  const base = baseUrl(options.base);
  if (options.mode === 'worker') { const p = edge({ base }); return { ...p, name: 'cloudflare-worker', descriptor: { factory: 'cloudflare', options: { ...options } } }; }
  if (options.mode === 'hosted') invariant(options.accountHash && /^[\w-]+$/.test(options.accountHash) && options.variant && /^[\w-]+$/.test(options.variant), 'PROVIDER', 'Hosted Images requires an accountHash and named variant.');
  return provider('cloudflare', { ...rasterCapabilities, formats: ['avif', 'webp', 'jpeg'], explicitFormat: false, fixed: options.mode === 'hosted', fit: ['cover', 'inside', 'scale-down'], maxWidthByFormat: { avif: 1200 } }, r => {
    if (options.mode === 'hosted') { invariant(r.key && !r.url && !r.w && !r.h && r.format === 'auto', 'CAPABILITY', 'Named hosted variants do not accept arbitrary transforms; use URL/Worker mode.', 422); return `https://imagedelivery.net/${options.accountHash}/${encodeURIComponent(r.key)}/${options.variant}`; }
    invariant(r.format !== 'avif' || Math.max(r.w ?? 0, r.h ?? 0) * r.dpr <= 1200, 'CAPABILITY', 'Cloudflare AVIF exceeds its documented 1200px limit; choose WebP.', 422);
    invariant(r.position !== 'entropy', 'CAPABILITY', 'Cloudflare saliency cropping cannot reproduce entropy cropping.', 422);
    const dim = dimensions(r);
    const anchors: Record<string, string> = { 'top-left': '0x0', 'top-right': '1x0', 'bottom-left': '0x1', 'bottom-right': '1x1', attention: 'auto' };
    const params = { ...(dim.w ? { width: dim.w } : {}), ...(dim.h ? { height: dim.h } : {}), quality: r.q, format: r.format, fit: r.fit === 'inside' ? 'scale-down' : r.fit, metadata: 'none', ...(r.position === 'center' ? {} : { gravity: anchors[r.position] ?? r.position }) };
    return `${base}/cdn-cgi/image/${Object.entries(params).map(([k, v]) => `${k}=${v}`).join(',')}/${source(r).replace(/^\//, '')}`;
  }, { factory: 'cloudflare', options: { ...options } });
}

import { defaults } from '../core/config.js';
import { normalizeRequest } from '../core/url.js';
import { invariant } from '../core/errors.js';
import type { ImageProvider, ImageRequest, NormalizedRequest, ProviderCapabilities } from '../core/types.js';

export const rasterCapabilities: ProviderCapabilities = { formats: ['avif', 'webp', 'jpeg', 'png'], fit: ['cover', 'contain', 'fill', 'inside', 'outside', 'scale-down'], smartCrop: true, animation: true, signature: false };
export interface ProviderDescriptor { factory: string; options: Record<string, string | number | boolean> }
export type SerializableProvider = ImageProvider & { descriptor: ProviderDescriptor };
/** Shared validation prevents unsupported nondefault operations from silently disappearing. */
export function provider(name: string, capabilities: ProviderCapabilities, render: (r: NormalizedRequest) => string, descriptor: ProviderDescriptor, operations: readonly (keyof ImageRequest)[] = ['w', 'h', 'dpr', 'q', 'format', 'fit', 'position']): SerializableProvider {
  const instance: SerializableProvider = { name, capabilities, descriptor, validate() { invariant(name && capabilities.formats.length, 'PROVIDER', 'Invalid image provider.'); }, buildUrl(input) {
    const r = normalizeRequest(input);
    if (r.format !== 'auto') invariant(capabilities.formats.includes(r.format), 'CAPABILITY', `${name} cannot emit ${r.format}.`, 422);
    invariant(capabilities.fit.includes(r.fit) && (capabilities.smartCrop || !['attention', 'entropy'].includes(r.position)), 'CAPABILITY', `${name} does not support the requested fit/crop.`, 422);
    for (const key of ['blur', 'sharpen', 'bg', 'rotate', 'flip', 'metadata', 'animation', 'sig'] as const) {
      const empty = { blur: 0, sharpen: 0, bg: undefined, rotate: 0, flip: 'none', metadata: 'none', animation: 'preserve', sig: undefined };
      invariant(operations.includes(key) || r[key] === empty[key], 'CAPABILITY', `${name} does not support ${key}.`, 422);
    }
    return render(r);
  } };
  instance.validate(); return instance;
}
export function source(r: ImageRequest): string { return r.url ?? `/${r.key}`; }
export function baseUrl(base = ''): string { invariant(base === '' || /^https:\/\/[^\s]+$/.test(base) || /^\/[\w/-]+$/.test(base), 'PROVIDER', 'Provider base must be HTTPS or a safe same-origin path.'); return base.replace(/\/$/, ''); }
export function dimensions(r: NormalizedRequest): Record<string, string> { return Object.fromEntries([['w', r.w ? String(Math.round(r.w * r.dpr)) : undefined], ['h', r.h ? String(Math.round(r.h * r.dpr)) : undefined]].filter((v): v is [string, string] => v[1] !== undefined)); }
export { defaults };

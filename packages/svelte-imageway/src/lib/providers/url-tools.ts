import { invariant } from '../core/errors.js';
import type { NormalizedRequest } from '../core/types.js';
export function endpoint(base: string): URL {
  const u = new URL(base);
  invariant(
    u.protocol === 'https:' && !u.username && !u.password && !u.search && !u.hash,
    'PROVIDER',
    'Use a public HTTPS endpoint without credentials or query.',
  );
  return u;
}
export function asset(base: string, r: NormalizedRequest): URL {
  const b = endpoint(base);
  if (r.url) {
    const u = new URL(r.url);
    invariant(
      u.origin === b.origin &&
        u.pathname.startsWith(b.pathname.endsWith('/') ? b.pathname : b.pathname + '/'),
      'PROVIDER_SOURCE',
      'Source must belong to the configured provider path.',
    );
    return u;
  }
  return new URL(
    b.href.replace(/\/$/, '') + '/' + r.key!.split('/').map(encodeURIComponent).join('/'),
  );
}
export function centered(r: NormalizedRequest): void {
  invariant(
    r.position === 'center',
    'CAPABILITY',
    'This provider supports center positioning only.',
    422,
  );
}
export function query(url: URL, values: Record<string, unknown>): string {
  for (const [k, v] of Object.entries(values))
    if (v !== undefined) url.searchParams.set(k, String(v));
  return url.href;
}
export const basic = {
  formats: ['webp', 'jpeg', 'png'] as const,
  fit: ['inside'] as const,
  smartCrop: false,
  animation: false,
  signature: false,
};
export function format(r: NormalizedRequest): string {
  return r.format === 'jpeg' ? 'jpg' : r.format;
}

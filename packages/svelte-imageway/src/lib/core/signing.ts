import { defaults } from './config.js';
import { invariant } from './errors.js';
import { canonicalQuery, normalizeRequest } from './url.js';
import type { ImageConfig, ImageRequest, NormalizedRequest } from './types.js';

const encoder = new TextEncoder();
async function key(secret: string, usage: KeyUsage[]): Promise<CryptoKey> {
  invariant(
    encoder.encode(secret).length >= 32,
    'SIGNING_KEY',
    'Signing secrets must contain at least 32 bytes.',
    500,
  );
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    usage,
  );
}
function payload(r: ImageRequest, config: ImageConfig): Uint8Array<ArrayBuffer> {
  return encoder.encode(
    `GET\n${config.endpoint}\nv1:${r.preset ? config.presets[r.preset]!.revision : '-'}\n${canonicalQuery(r, false)}`,
  );
}
/** Sign only on the server/build; never serialize secret material into public configuration. */
export async function signRequest(
  request: ImageRequest,
  options: { secret: string; kid: string; exp: number; config?: ImageConfig },
): Promise<NormalizedRequest> {
  const config = options.config ?? defaults;
  const r = normalizeRequest(
    { ...request, kid: options.kid, exp: options.exp, sig: undefined },
    config,
  );
  const bytes = new Uint8Array(
    await crypto.subtle.sign('HMAC', await key(options.secret, ['sign']), payload(r, config)),
  );
  const sig = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return Object.freeze({ ...r, sig });
}
/** Verify expiry and HMAC before any shared-cache lookup; previous key IDs enable rotation. */
export async function verifyRequest(
  request: ImageRequest,
  keys: Readonly<Record<string, string>>,
  options: { config?: ImageConfig; now?: number; maxLifetime?: number } = {},
): Promise<NormalizedRequest> {
  const config = options.config ?? defaults;
  const r = normalizeRequest(request, config);
  const now = options.now ?? Math.floor(Date.now() / 1000);
  invariant(
    r.kid && r.sig && r.exp && Object.hasOwn(keys, r.kid) && typeof keys[r.kid] === 'string',
    'SIGNATURE',
    'A valid signed image request is required.',
    401,
  );
  invariant(
    r.exp > now && r.exp - now <= (options.maxLifetime ?? 86400),
    'EXPIRED',
    'Image authorization expired or exceeds maximum lifetime.',
    401,
  );
  const bytes = Uint8Array.from(atob(r.sig.replace(/-/g, '+').replace(/_/g, '/')), (c) =>
    c.charCodeAt(0),
  );
  const valid = await crypto.subtle.verify(
    'HMAC',
    await key(keys[r.kid]!, ['verify']),
    bytes,
    payload(r, config),
  );
  invariant(valid, 'SIGNATURE', 'Invalid image signature.', 401);
  return r;
}

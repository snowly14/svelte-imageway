import { invariant } from '../core/errors.js';
import type { WorkerOptions } from './types.js';
type NativeFetch = (
  input: string,
  init: RequestInit & { cf: { image: Record<string, unknown> } },
) => Promise<Response>;
/**
 * cf.image alternative for an operator-owned public origin serving the same immutable
 * R2 keys. Arbitrary request URLs and redirects are deliberately unsupported.
 */
export function cfImageTransform(
  origin: string,
  nativeFetch: NativeFetch = fetch as NativeFetch,
): NonNullable<WorkerOptions['transform']> {
  const base = new URL(origin);
  invariant(
    base.protocol === 'https:' &&
      base.pathname === '/' &&
      !base.username &&
      !base.password &&
      !base.search &&
      !base.hash &&
      !base.port,
    'CF_ORIGIN',
    'cf.image requires an operator-owned HTTPS origin without credentials, paths, or custom ports.',
  );
  return async (r, _bytes, _env, format) => {
    invariant(
      r.key && !r.url && ['image/webp', 'image/jpeg'].includes(format),
      'CF_FORMAT',
      'Use WebP/JPEG in cf.image mode; AVIF can fall back to another MIME. Prefer the Images binding for explicit formats.',
      422,
    );
    invariant(
      ['inside', 'scale-down', 'cover'].includes(r.fit) && r.metadata === 'none',
      'CF_OPERATION',
      'cf.image mode supports the declared fit intersection and metadata stripping.',
      422,
    );
    const source = new URL(r.key.split('/').map(encodeURIComponent).join('/'), base).href;
    const response = await nativeFetch(source, {
      redirect: 'manual',
      cf: {
        image: {
          width: r.w ? Math.round(r.w * r.dpr) : undefined,
          height: r.h ? Math.round(r.h * r.dpr) : undefined,
          fit: r.fit === 'inside' ? 'scale-down' : r.fit,
          quality: r.q,
          format: format.slice(6),
          metadata: 'none',
          anim: r.animation === 'preserve',
        },
      },
    });
    invariant(
      response.status === 200,
      'CF_ORIGIN',
      'Approved image origin failed or redirected.',
      502,
    );
    return response;
  };
}

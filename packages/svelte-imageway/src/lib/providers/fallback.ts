import { invariant, ImagewayError } from '../core/errors.js';
import type { ImageProvider, ImageRequest } from '../core/types.js';
export interface FallbackOptions {
  providers: readonly ImageProvider[];
  /** Required transport must enforce origin allowlists, DNS pinning and byte limits. No ambient fetch proxy. */
  transport: (url: string, signal: AbortSignal) => Promise<Response>;
  timeoutMs?: number;
  failureThreshold?: number;
  cooldownMs?: number;
  /** Optional original fallback must independently authorize access; never receives auth-failed requests. */
  original?: (request: ImageRequest, signal: AbortSignal) => Promise<Response>;
}
/** Server transport circuit breaker: only timeout/network/5xx may advance. Security and budget errors fail closed. */
export function createFallback(options: FallbackOptions) {
  invariant(
    options.providers.length > 0 && options.providers.length <= 8,
    'FALLBACK',
    'Configure 1–8 trusted providers.',
  );
  const state = options.providers.map(() => ({ failures: 0, until: 0, probe: false }));
  async function deadline<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    try {
      return await Promise.race([
        operation(controller.signal),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new ImagewayError('TIMEOUT', 'Provider deadline exceeded.', 504));
          }, options.timeoutMs ?? 5000);
        }),
      ]);
    } finally {
      clearTimeout(timer!);
    }
  }
  return {
    state,
    async fetch(request: ImageRequest): Promise<Response> {
      for (const [i, provider] of options.providers.entries()) {
        const s = state[i]!;
        if (s.until > Date.now() || s.probe) continue;
        const url = provider.buildUrl(request); // Configuration/capability/auth errors never trigger a fallback.
        if (s.until) s.probe = true;
        try {
          const response = await deadline((signal) => options.transport(url, signal));
          if (response.status < 500) {
            s.failures = 0;
            s.until = 0;
            return response;
          }
          await response.body?.cancel();
        } catch (error) {
          if (error instanceof ImagewayError && error.status !== 504 && error.status < 500)
            throw error;
        } finally {
          s.probe = false;
        }
        if (++s.failures >= (options.failureThreshold ?? 3))
          s.until = Date.now() + (options.cooldownMs ?? 30000);
      }
      if (options.original) return deadline((signal) => options.original!(request, signal));
      return new Response('Image providers unavailable.', {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      });
    },
  };
}

import type { Handle } from '@sveltejs/kit/hooks';
import { join } from 'node:path';
import { defineConfig } from '../core/config.js';
import { ImagewayError, invariant } from '../core/errors.js';
import { parseRequest } from '../core/url.js';
import { negotiateFormat, mimeType } from '../core/accept.js';
import { verifyRequest } from '../core/signing.js';
import type { ImageConfig } from '../core/types.js';
import { fetchRemote, readLocal } from '../node/source.js';
import { ImageProcessor } from '../node/processor.js';
import { hash, MemoryCache, SingleFlight } from '../node/cache.js';

export interface ImageHandlerOptions {
  config?: Partial<ImageConfig>;
  sourceRoot?: string;
  cacheDirectory?: string;
  /** Map public key IDs to environment variable names, never to literal secrets. */
  signingKeys?: Readonly<Record<string, string>>;
  requireSignature?: boolean;
  /** Default: only locked preset requests may be unsigned. */
  allowUnsignedPresets?: boolean;
  publicSources?: boolean;
  corsOrigin?: string;
  maxRequestsPerMinute?: number;
  maxTransformsPerHour?: number;
  /** Inject a shared platform limiter for multiple processes/isolates. */
  guard?: (request: Request) => Promise<boolean>;
  log?: (event: { code: string; status: number; durationMs: number }) => void;
}
/** Framework-neutral Fetch handler; use the Kit wrapper below or a Node/Bun service. */
export function createImageService(options: ImageHandlerOptions = {}) {
  const config = defineConfig(options.config);
  const processor = new ImageProcessor({
    directory:
      options.cacheDirectory ?? join(process.cwd(), 'node_modules/.cache/svelte-imageway-runtime'),
    config,
    onTransform: () => {
      const currentHour = Math.floor(Date.now() / 3600_000);
      if (currentHour !== hour) {
        hour = currentHour;
        hourTransforms = 0;
      }
      invariant(
        hourTransforms < (options.maxTransformsPerHour ?? 10000),
        'BUDGET',
        'Transformation budget reached.',
        429,
      );
      hourTransforms++;
    },
  });
  const sources = new MemoryCache(config.maxInputBytes * 2);
  const flight = new SingleFlight<Buffer>();
  const metrics = { requests: 0, errors: 0, responses: 0, bytes: 0, hits: 0 };
  let minute = 0,
    requests = 0,
    hour = 0;
  let hourTransforms = 0;
  let active = 0;
  async function fetchImage(request: Request): Promise<Response> {
    const start = performance.now();
    metrics.requests++;
    if (active >= 8)
      return Response.json(
        { error: 'CAPACITY' },
        { status: 429, headers: { 'Cache-Control': 'no-store' } },
      );
    active++;
    try {
      invariant(
        request.method === 'GET' || request.method === 'HEAD',
        'METHOD',
        'Only GET and HEAD are supported.',
        405,
      );
      const url = new URL(request.url);
      invariant(url.pathname === config.endpoint, 'NOT_FOUND', 'Image endpoint not found.', 404);
      const currentMinute = Math.floor(Date.now() / 60000);
      if (minute !== currentMinute) {
        minute = currentMinute;
        requests = 0;
      }
      invariant(
        ++requests <= (options.maxRequestsPerMinute ?? 1000),
        'RATE',
        'Image request budget reached.',
        429,
      );
      if (options.guard)
        invariant(await options.guard(request), 'RATE', 'Shared image budget reached.', 429);
      let r = parseRequest(url.search, config);
      const signed = [r.sig, r.exp, r.kid].some((v) => v !== undefined);
      if (
        signed ||
        options.requireSignature ||
        !(options.allowUnsignedPresets !== false && r.preset)
      ) {
        const keys = Object.fromEntries(
          Object.entries(options.signingKeys ?? {}).map(([kid, variable]) => [
            kid,
            process.env[variable] ?? '',
          ]),
        );
        r = await verifyRequest(r, keys, { config });
      }
      const saveData = request.headers.get('save-data') === 'on';
      const sourceIdentity = hash(r.url ?? `${options.sourceRoot ?? ''}:${r.key}`);
      const input = await flight.run(sourceIdentity, async () => {
        const cached = sources.get(sourceIdentity);
        if (cached) return cached;
        let bytes: Buffer;
        if (r.url) bytes = await fetchRemote(r.url, config);
        else {
          invariant(
            options.sourceRoot,
            'SOURCE_ROOT',
            'Configure sourceRoot for local object keys.',
            403,
          );
          bytes = await readLocal(r.key!, options.sourceRoot, config.maxInputBytes);
        }
        sources.set(sourceIdentity, bytes, 60000);
        return bytes;
      });
      if (r.rev)
        invariant(
          r.rev === hash(input),
          'REVISION',
          'Source revision does not match its content hash.',
          409,
        );
      const format =
        r.format === 'auto'
          ? negotiateFormat(request.headers.get('accept'), config.formats)
          : r.format;
      invariant(
        config.formats.includes(format),
        'FORMAT',
        'Output format is disabled by configuration.',
        415,
      );
      const result = await processor.process(input, r, format, saveData ? 65 : undefined, false);
      const hit = result.cacheHit;
      if (hit) metrics.hits++;
      const etag = `"${hash(result.data)}"`;
      const publicCache = options.publicSources === true;
      const publicPolicy = signed
        ? `public, max-age=${Math.max(0, Math.min(r.rev ? 31536000 : 60, r.exp! - Math.floor(Date.now() / 1000)))}, must-revalidate`
        : r.rev
          ? 'public, max-age=31536000, immutable'
          : 'public, max-age=60, stale-while-revalidate=300';
      const headers = new Headers({
        'Content-Type': mimeType(format),
        'Content-Length': String(result.data.length),
        'Cache-Control': publicCache ? publicPolicy : 'private, no-store',
        ETag: etag,
        Vary: 'Accept, Save-Data',
        'X-Content-Type-Options': 'nosniff',
        'Accept-Ranges': 'none',
        'Content-Disposition': `inline; filename="${hash(result.data)}.${format}"`,
        'Server-Timing': `imageway;dur=${(performance.now() - start).toFixed(1)}`,
        'X-Imageway-Cache': hit ? 'HIT' : 'MISS',
      });
      if (options.corsOrigin) headers.set('Access-Control-Allow-Origin', options.corsOrigin);
      metrics.responses++;
      metrics.bytes += result.data.length;
      const validators = request.headers
        .get('if-none-match')
        ?.split(',')
        .map((v) => v.trim().replace(/^W\//, ''));
      if (validators?.includes(etag) || validators?.includes('*')) {
        headers.delete('Content-Length');
        return new Response(null, { status: 304, headers });
      }
      return new Response(request.method === 'HEAD' ? null : new Uint8Array(result.data), {
        headers,
      });
    } catch (error) {
      const failure =
        error instanceof ImagewayError
          ? error
          : new ImagewayError(
              'INTERNAL',
              'Image processing failed. Inspect server configuration and supported codecs.',
              500,
            );
      metrics.errors++;
      options.log?.({
        code: failure.code,
        status: failure.status,
        durationMs: performance.now() - start,
      });
      return Response.json(
        { error: failure.code, message: failure.message },
        {
          status: failure.status,
          headers: {
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
            ...(failure.status === 429 ? { 'Retry-After': '60' } : {}),
          },
        },
      );
    } finally {
      active--;
    }
  }
  return { fetch: fetchImage, metrics };
}
/** Compose with existing Kit hooks using sequence; no global request state. */
export function imageHandle(options: ImageHandlerOptions = {}): Handle {
  const service = createImageService(options);
  const endpoint = options.config?.endpoint ?? '/_img/v1';
  return async ({ event, resolve }) =>
    event.url.pathname === endpoint ? service.fetch(event.request) : resolve(event);
}
/** Attach an ordinary HTTP Link hint before streaming headers are committed. */
export function imagePreloadHandle(
  hints: (event: Parameters<Handle>[0]['event']) => string[],
): Handle {
  return async ({ event, resolve }) => {
    const links = hints(event);
    const response = await resolve(event);
    if (!links.length) return response;
    const headers = new Headers(response.headers);
    headers.append('Link', links.join(', '));
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}

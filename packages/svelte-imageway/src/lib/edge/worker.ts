import { rasterFrames } from '../core/raster.js';
import { PIPELINE_REVISION } from '../version.js';
import { defineConfig } from '../core/config.js';
import { parseRequest, canonicalQuery } from '../core/url.js';
import { verifyRequest } from '../core/signing.js';
import { mimeType, negotiateFormat } from '../core/accept.js';
import { ImagewayError, invariant } from '../core/errors.js';
import type {
  EdgeEnv,
  ExecutionContextLike,
  ImageTransformOptions,
  WorkerOptions,
} from './types.js';
import type { NormalizedRequest } from '../core/types.js';

const defaultConfig = defineConfig({
  formats: ['avif', 'webp', 'jpeg', 'png', 'gif'],
  maxInputBytes: 8_000_000,
  maxOutputBytes: 8_000_000,
  maxPixels: 16_000_000,
});
const encoder = new TextEncoder();
async function digest(bytes: Uint8Array<ArrayBuffer> | string): Promise<string> {
  const hash = await crypto.subtle.digest(
    'SHA-256',
    typeof bytes === 'string' ? encoder.encode(bytes) : bytes,
  );
  return [...new Uint8Array(hash)].map((v) => v.toString(16).padStart(2, '0')).join('');
}
async function body(
  stream: ReadableStream<Uint8Array>,
  maximum: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const reader = stream.getReader(),
    chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      length += item.value.length;
      invariant(length <= maximum, 'BYTES', 'Image exceeds byte limit.', 413);
      chunks.push(item.value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
async function authorized(request: Request, expected?: string): Promise<boolean> {
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!expected || expected.length < 32 || !token || token.length > 256) return false;
  const payload = encoder.encode('imageway-admin');
  const importKey = (value: string) =>
    crypto.subtle.importKey(
      'raw',
      encoder.encode(value),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify'],
    );
  const signature = await crypto.subtle.sign('HMAC', await importKey(token), payload);
  return crypto.subtle.verify('HMAC', await importKey(expected), signature, payload);
}
/** R2-key-only Worker: arbitrary URLs are denied because Workers cannot pin DNS/TLS destinations. */
export function createImageWorker(options: WorkerOptions = {}) {
  const config = defineConfig({ ...defaultConfig, ...options.config });
  invariant(
    config.maxInputBytes * 2 + config.maxOutputBytes * 3 <= 64_000_000,
    'MEMORY',
    'Worker byte limits exceed its reserved memory budget. Reduce input/output limits.',
    500,
  );
  const metrics = { requests: 0, hits: 0, transforms: 0, bytes: 0, errors: 0 };
  const pending = new Map<string, Promise<Response>>();
  let pipeline: Promise<unknown> = Promise.resolve();
  let queued = 0;
  return {
    async fetch(request: Request, env: EdgeEnv, ctx: ExecutionContextLike): Promise<Response> {
      const started = performance.now();
      metrics.requests++;
      let cacheStatus = 'MISS';
      try {
        const url = new URL(request.url);
        if (url.pathname === '/health')
          return Response.json({ status: 'ok', service: 'imageway', protocol: 'v1' });
        if (url.pathname === '/metrics') {
          invariant(
            await authorized(request, env.METRICS_TOKEN),
            'AUTH',
            'Metrics are disabled or unauthorized.',
            403,
          );
          return Response.json(metrics);
        }
        const budget = env.BUDGET.getByName('imageway');
        if (url.pathname === '/purge') {
          invariant(
            request.method === 'POST' && (await authorized(request, env.PURGE_TOKEN)),
            'AUTH',
            'Purge is unauthorized.',
            403,
          );
          invariant(
            Number(request.headers.get('content-length') ?? 0) <= 8192,
            'BYTES',
            'Purge request too large.',
            413,
          );
          invariant(request.body, 'PURGE', 'Provide a JSON purge selector.', 400);
          const bytes = await body(request.body, 8192);
          let selection: unknown;
          try {
            selection = JSON.parse(new TextDecoder().decode(bytes));
          } catch {
            throw new ImagewayError('PURGE', 'Provide valid JSON.', 400);
          }
          invariant(
            selection &&
              typeof selection === 'object' &&
              'kind' in selection &&
              'value' in selection,
            'PURGE',
            'Provide kind and value.',
            400,
          );
          return budget.fetch(
            new Request('https://budget/purge', {
              method: 'POST',
              body: JSON.stringify({ kind: selection.kind, value: selection.value, op: 'purge' }),
            }),
          );
        }
        invariant(url.pathname === config.endpoint, 'NOT_FOUND', 'Image endpoint not found.', 404);
        invariant(
          request.method === 'GET' || request.method === 'HEAD',
          'METHOD',
          'Only GET/HEAD supported.',
          405,
        );
        let r = parseRequest(url.search, config);
        invariant(
          !r.url && r.key?.startsWith(env.SOURCE_PREFIX ?? 'images/'),
          'SOURCE',
          'Worker accepts approved R2 keys only. Use the Node service for arbitrary allowlisted HTTPS sources.',
          403,
        );
        const signed = [r.sig, r.kid, r.exp].some((v) => v !== undefined);
        if (signed || env.PUBLIC_SOURCES !== 'true' || !r.preset) {
          const keys = {
            ...(env.SIGNING_KEY_CURRENT ? { current: env.SIGNING_KEY_CURRENT } : {}),
            ...(env.SIGNING_KEY_PREVIOUS ? { previous: env.SIGNING_KEY_PREVIOUS } : {}),
          };
          r = await verifyRequest(r, keys, { config });
        }
        const saveData = request.headers.get('save-data') === 'on';
        if (saveData && r.q > 65)
          r = Object.freeze({
            ...r,
            q: config.qualities.filter((q) => q <= 65 && q <= r.q).at(-1) ?? r.q,
          });
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
        invariant(format !== 'svg', 'FORMAT', 'Worker only serves raster representations.', 415);
        const cache = options.cache ?? (await caches.open('svelte-imageway-v1'));
        const { sig: _sig, exp: _exp, kid: _kid, ...output } = r;
        void _sig;
        void _exp;
        void _kid;
        const identity = await digest(
          `${PIPELINE_REVISION}:${canonicalQuery({ ...output, format })}`,
        );
        const cacheKey = new Request(`${url.origin}/__imageway_cache/${identity}`);
        const state = async (tags: string[], consume?: 'request' | 'transform') => {
          const response = await budget.fetch(
            new Request('https://budget/state', {
              method: 'POST',
              body: JSON.stringify({
                op: 'state',
                key: r.key,
                tags,
                consume,
                rateLimit: Number(env.MAX_REQUESTS_PER_MINUTE ?? 1000),
                transformLimit: Number(env.MAX_TRANSFORMS_PER_HOUR ?? 10000),
                monthlyLimit: Number(env.MAX_TRANSFORMS_PER_MONTH ?? 4000),
              }),
            }),
          );
          invariant(
            response.ok,
            'BUDGET',
            'Shared request or transform budget reached.',
            response.status,
          );
          return ((await response.json()) as { version: string }).version;
        };
        const cached = await cache.match(cacheKey);
        const tags =
          cached?.headers.get('x-imageway-internal-tags')?.split(',').filter(Boolean) ?? [];
        const version = await state(tags, 'request');
        let response: Response;
        if (cached && cached.headers.get('x-imageway-internal-version') === version) {
          response = cached;
          metrics.hits++;
          cacheStatus = 'HIT';
        } else {
          const current = pending.get(identity);
          if (current) response = (await current).clone();
          else {
            invariant(queued < 16, 'QUEUE', 'Worker transform capacity reached.', 429);
            queued++;
            const operation = pipeline
              .then(async () => {
                invariant(
                  performance.now() - started < config.timeoutMs && !request.signal.aborted,
                  'TIMEOUT',
                  'Image request expired in the bounded queue.',
                  504,
                );
                const object = await env.ORIGINALS.get(r.key!);
                invariant(
                  object && object.size <= config.maxInputBytes,
                  'INPUT',
                  'Source is missing or exceeds byte limit.',
                  object ? 413 : 404,
                );
                const sourceTags = (object.customMetadata?.tags ?? '')
                  .split(',')
                  .filter((v) => /^[\w-]{1,32}$/.test(v))
                  .slice(0, 8);
                const generation = await state(sourceTags);
                const bytes = await body(object.body, config.maxInputBytes);
                if (r.rev)
                  invariant(
                    (await digest(bytes)) === r.rev,
                    'REVISION',
                    'Source content revision does not match.',
                    409,
                  );
                const contentKey = `${identity}-${await digest(generation)}`;
                let encoded: Response | undefined;
                const secondary = await env.VARIANTS?.get(contentKey);
                if (
                  secondary &&
                  Date.now() - Number(secondary.customMetadata?.created ?? 0) <
                    (r.rev ? 365 * 86400_000 : 60_000)
                )
                  encoded = new Response(await body(secondary.body, config.maxOutputBytes), {
                    headers: {
                      'Content-Type': secondary.httpMetadata?.contentType ?? mimeType(format),
                    },
                  });
                const fromSecondary = Boolean(encoded);
                if (!encoded) {
                  invariant(
                    performance.now() - started < config.timeoutMs && !request.signal.aborted,
                    'TIMEOUT',
                    'Image response deadline expired.',
                    504,
                  );
                  await state(sourceTags, 'transform');
                  metrics.transforms++;
                  // Keep the serialization permit until native work actually settles.
                  // The outer deadline bounds the response, not the native lifetime.
                  encoded = await (options.transform
                    ? options.transform(r, bytes, env, mimeType(format))
                    : transformBinding(r, bytes, env, mimeType(format), config));
                }
                invariant(
                  encoded.ok &&
                    encoded.headers.get('content-type')?.split(';')[0] === mimeType(format),
                  'ENCODER',
                  'Provider returned an unexpected representation.',
                  502,
                );
                const encodedBytes = await body(encoded.body!, config.maxOutputBytes);
                metrics.bytes += encodedBytes.length;
                const headers = new Headers({
                  'Content-Type': mimeType(format),
                  'Content-Length': String(encodedBytes.length),
                  ETag: `"${await digest(encodedBytes)}"`,
                  'Cache-Control': `public, max-age=${r.rev ? 31536000 : 60}`,
                  'x-imageway-internal-tags': sourceTags.join(','),
                  'x-imageway-internal-version': generation,
                });
                const stored = new Response(encodedBytes, { headers });
                ctx.waitUntil(
                  Promise.all([
                    cache.put(cacheKey, stored.clone()),
                    !fromSecondary
                      ? env.VARIANTS?.put(contentKey, encodedBytes, {
                          httpMetadata: { contentType: mimeType(format) },
                          customMetadata: { created: String(Date.now()) },
                        })
                      : undefined,
                  ]),
                );
                return stored;
              })
              .finally(() => queued--);
            pipeline = operation.catch(() => {});
            const job = withDeadline(operation, config.timeoutMs);
            pending.set(identity, job);
            try {
              response = (await job).clone();
            } finally {
              pending.delete(identity);
            }
          }
        }
        const headers = new Headers(response.headers);
        headers.delete('x-imageway-internal-tags');
        headers.delete('x-imageway-internal-version');
        headers.set('Vary', 'Accept, Save-Data');
        headers.set('X-Content-Type-Options', 'nosniff');
        headers.set('Accept-Ranges', 'none');
        headers.set('Content-Disposition', `inline; filename="${identity}.${format}"`);
        headers.set('Server-Timing', `imageway;dur=${(performance.now() - started).toFixed(1)}`);
        headers.set('X-Imageway-Cache', cacheStatus);
        headers.set(
          'Cache-Control',
          env.PUBLIC_SOURCES === 'true'
            ? signed
              ? `public, max-age=${Math.max(0, Math.min(r.rev ? 31536000 : 60, r.exp! - Math.floor(Date.now() / 1000)))}, must-revalidate`
              : r.rev
                ? 'public, max-age=31536000, immutable'
                : 'public, max-age=60, stale-while-revalidate=300'
            : 'private, no-store',
        );
        if (env.CORS_ORIGIN) headers.set('Access-Control-Allow-Origin', env.CORS_ORIGIN);
        const notModified = request.headers
          .get('if-none-match')
          ?.split(',')
          .map((v) => v.trim().replace(/^W\//, ''))
          .some((v) => v === headers.get('etag') || v === '*');
        if (notModified) headers.delete('Content-Length');
        options.observe?.({
          status: notModified ? 304 : 200,
          durationMs: performance.now() - started,
          cache: cacheStatus,
        });
        return new Response(notModified || request.method === 'HEAD' ? null : response.body, {
          status: notModified ? 304 : 200,
          headers,
        });
      } catch (error) {
        metrics.errors++;
        const e =
          error instanceof ImagewayError
            ? error
            : new ImagewayError(
                'EDGE',
                'Worker image processing failed; check bindings and offline/production capabilities.',
                502,
              );
        if (env.DEBUG === 'true')
          console.log(JSON.stringify({ event: 'imageway.error', code: e.code, status: e.status }));
        options.observe?.({
          status: e.status,
          durationMs: performance.now() - started,
          cache: cacheStatus,
        });
        return Response.json(
          { error: e.code, message: e.message },
          {
            status: e.status,
            headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
          },
        );
      }
    },
  };
}
async function transformBinding(
  r: NormalizedRequest,
  bytes: Uint8Array<ArrayBuffer>,
  env: EdgeEnv,
  format: string,
  config: typeof defaultConfig,
): Promise<Response> {
  invariant(env.IMAGES, 'BINDING', 'Configure an Images binding for this Worker.', 503);
  // Reject XML/SVG before passing untrusted input to a remote decoder; raster output only.
  const head = new TextDecoder().decode(bytes.subarray(0, 256)).trimStart();
  invariant(
    !head.startsWith('<'),
    'SVG',
    'Worker SVG input is disabled. Rasterize approved SVG at build time.',
    415,
  );
  const frames = rasterFrames(bytes);
  const info = await env.IMAGES.info(new Response(bytes).body!);
  invariant(
    info.width &&
      info.height &&
      info.width * info.height * frames <= config.maxPixels &&
      info.width <= 12000 &&
      info.height <= 12000,
    'PIXELS',
    'Image metadata exceeds pixel limits or is unsupported.',
    413,
  );
  invariant(
    r.metadata === 'none',
    'CAPABILITY',
    'This binding cannot preserve selected metadata.',
    422,
  );
  const offline = env.LOCAL_OFFLINE === 'true';
  invariant(
    !offline || format !== 'image/gif',
    'OFFLINE_CAPABILITY',
    'The local Images emulator cannot encode GIF. Use WebP locally and verify GIF with the production binding.',
    422,
  );
  invariant(
    !offline ||
      (r.fit === 'inside' && !r.blur && !r.sharpen && r.flip === 'none' && r.position === 'center'),
    'OFFLINE_CAPABILITY',
    'Offline Images supports only basic resize/rotate/format. Test this operation against the real binding.',
    422,
  );
  const options: ImageTransformOptions = {
    width: r.w ? Math.round(r.w * r.dpr) : undefined,
    height: r.h ? Math.round(r.h * r.dpr) : undefined,
    rotate: r.rotate,
  };
  if (!offline) {
    invariant(
      r.fit !== 'outside',
      'CAPABILITY',
      'Outside fit is not supported by this Worker binding.',
      422,
    );
    Object.assign(options, {
      fit:
        r.fit === 'inside' || r.fit === 'scale-down'
          ? 'scale-down'
          : r.fit === 'contain'
            ? 'pad'
            : r.fit === 'fill'
              ? 'squeeze'
              : 'crop',
      gravity: r.position.includes('-')
        ? {
            x: r.position.endsWith('left') ? 0 : 1,
            y: r.position.startsWith('top') ? 0 : 1,
            mode: 'remainder',
          }
        : r.position === 'attention'
          ? 'auto'
          : r.position,
      blur: r.blur || undefined,
      sharpen: r.sharpen || undefined,
      background: r.bg === 'transparent' ? 'transparent' : r.bg ? `#${r.bg}` : undefined,
      flip: { none: undefined, horizontal: 'h', vertical: 'v', both: 'hv' }[r.flip],
    });
  }
  const output = await env.IMAGES.input(new Response(bytes).body!)
    .transform(options)
    .output({ format, ...(offline ? {} : { quality: r.q, anim: r.animation === 'preserve' }) });
  return output.response();
}

async function withDeadline<T>(operation: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new ImagewayError(
                'TIMEOUT',
                'Native image operation exceeded the response deadline.',
                504,
              ),
            ),
          milliseconds,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer!);
  }
}

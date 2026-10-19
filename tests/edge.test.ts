import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { createImageWorker } from '../packages/svelte-imageway/src/lib/edge/worker.js';
import { ImageBudget } from '../packages/svelte-imageway/src/lib/edge/budget.js';
import type {
  EdgeEnv,
  CacheLike,
  ObjectBody,
  WorkerOptions,
} from '../packages/svelte-imageway/src/lib/edge/types.js';
import { signRequest, canonicalQuery } from '../packages/svelte-imageway/src/lib/core/index.js';

function storage() {
  const values = new Map<string, unknown>();
  let queue: Promise<unknown> = Promise.resolve();
  const kv = {
    async get<T>(key: string) {
      return structuredClone(values.get(key)) as T | undefined;
    },
    async put<T>(key: string, value: T) {
      values.set(key, structuredClone(value));
    },
  };
  return {
    ...kv,
    transaction<T>(callback: (value: typeof kv) => Promise<T>): Promise<T> {
      const task = queue.then(() => callback(kv));
      queue = task.catch(() => {});
      return task;
    },
  };
}
async function fixture(options: WorkerOptions = {}) {
  const bytes = await sharp({
    create: { width: 640, height: 400, channels: 3, background: 'cyan' },
  })
    .png()
    .toBuffer();
  const entries = new Map<string, Response>();
  const cache: CacheLike = {
    async match(req) {
      return entries.get(req.url)?.clone();
    },
    async put(req, response) {
      entries.set(req.url, response.clone());
    },
  };
  const budget = new ImageBudget({ storage: storage() });
  let transforms = 0;
  const object: ObjectBody = {
    size: bytes.length,
    body: new Response(bytes).body!,
    customMetadata: { tags: 'landscape' },
    arrayBuffer: async () =>
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) as ArrayBuffer,
  };
  const env: EdgeEnv = {
    PUBLIC_SOURCES: 'true',
    SOURCE_PREFIX: 'images/',
    ORIGINALS: {
      async get(key) {
        return key === 'images/a.png' ? { ...object, body: new Response(bytes).body! } : null;
      },
      async put() {},
    },
    BUDGET: {
      getByName() {
        return budget;
      },
    },
    PURGE_TOKEN: 'admin-purge-key-with-at-least-32-bytes',
    METRICS_TOKEN: 'admin-metrics-key-with-at-least-32-bytes',
  };
  const worker = createImageWorker({
    cache,
    transform: async (r, data, _env, format) => {
      transforms++;
      const encoded = await sharp(data)
        .resize({ width: r.w, withoutEnlargement: true })
        .toFormat(format.slice(6) as 'webp', { quality: r.q })
        .toBuffer();
      return new Response(encoded, { headers: { 'Content-Type': format } });
    },
    ...options,
  });
  const writes: Promise<unknown>[] = [];
  const ctx = {
    waitUntil(promise: Promise<unknown>) {
      writes.push(promise);
    },
  };
  const fetch = async (
    url = 'https://worker.example/_img/v1?key=images/a.png&preset=card&format=webp',
    init?: RequestInit,
  ) => {
    const response = await worker.fetch(new Request(url, init), env, ctx);
    await Promise.all(writes.splice(0));
    return response;
  };
  return { worker, env, ctx, fetch, entries, transforms: () => transforms, budget };
}
describe('portable Worker policy and cache', () => {
  it('serves actual encoded bytes, normalizes format keys and returns HEAD/304', async () => {
    const f = await fixture();
    const first = await f.fetch();
    expect(first.status).toBe(200);
    expect(first.headers.get('content-type')).toBe('image/webp');
    expect((await sharp(Buffer.from(await first.arrayBuffer())).metadata()).width).toBe(640);
    const second = await f.fetch();
    expect(second.headers.get('x-imageway-cache')).toBe('HIT');
    expect(f.transforms()).toBe(1);
    expect(second.headers.has('x-imageway-internal-tags')).toBe(false);
    const conditional = await f.fetch(undefined, {
      headers: { 'If-None-Match': second.headers.get('etag')! },
    });
    expect(conditional.status).toBe(304);
    expect(await conditional.text()).toBe('');
    expect(await (await f.fetch(undefined, { method: 'HEAD' })).text()).toBe('');
    const save = await f.fetch(undefined, { headers: { 'Save-Data': 'on' } });
    expect(save.status).toBe(200);
    expect(f.transforms()).toBe(2);
    expect(
      (
        await f.fetch('https://worker.example/_img/v1?key=images/a.png&preset=card', {
          headers: { Accept: 'image/jpeg' },
        })
      ).headers.get('content-type'),
    ).toBe('image/jpeg');
  });
  it('denies external URL proxies, traversal, private keys, malformed and missing input', async () => {
    const f = await fixture();
    for (const query of [
      'url=https%3A%2F%2F169.254.169.254%2F&preset=card',
      'key=private/a.png&preset=card',
    ])
      expect((await f.fetch('https://worker.example/_img/v1?' + query)).status).toBe(403);
    expect((await f.fetch('https://worker.example/_img/v1?key=../a&preset=card')).status).toBe(400);
    expect(
      (await f.fetch('https://worker.example/_img/v1?key=images/missing&preset=card')).status,
    ).toBe(404);
    expect((await f.fetch(undefined, { method: 'POST' })).status).toBe(405);
    f.env.PUBLIC_SOURCES = 'false';
    expect((await f.fetch()).status).toBe(401);
    expect(f.transforms()).toBe(0);
  });
  it('verifies expiring signatures before cache hits and uses private response caching', async () => {
    const f = await fixture();
    f.env.PUBLIC_SOURCES = 'false';
    f.env.SIGNING_KEY_CURRENT = 'a-private-worker-secret-of-at-least-32-bytes';
    const now = Math.floor(Date.now() / 1000);
    const signed = await signRequest(
      { key: 'images/a.png', w: 640, format: 'webp' },
      { secret: f.env.SIGNING_KEY_CURRENT, kid: 'current', exp: now + 60 },
    );
    const response = await f.fetch('https://worker.example/_img/v1?' + canonicalQuery(signed));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    const expired = await signRequest(
      { key: 'images/a.png', w: 640, format: 'webp' },
      { secret: f.env.SIGNING_KEY_CURRENT, kid: 'current', exp: now - 1 },
    );
    expect(
      (await f.fetch('https://worker.example/_img/v1?' + canonicalQuery(expired))).status,
    ).toBe(401);
  });
  it.each(['key', 'prefix', 'tag'] as const)(
    'invalidates by %s through shared state without exposing admin routes',
    async (kind) => {
      const f = await fixture();
      await f.fetch();
      expect(f.transforms()).toBe(1);
      const value = kind === 'key' ? 'images/a.png' : kind === 'prefix' ? 'images/' : 'landscape';
      expect(
        (
          await f.fetch('https://worker.example/purge', {
            method: 'POST',
            body: JSON.stringify({ kind, value }),
          })
        ).status,
      ).toBe(403);
      const purge = await f.fetch('https://worker.example/purge', {
        method: 'POST',
        headers: { Authorization: `Bearer ${f.env.PURGE_TOKEN}` },
        body: JSON.stringify({ kind, value }),
      });
      expect(purge.status).toBe(200);
      await f.fetch();
      expect(f.transforms()).toBe(2);
      expect((await f.fetch('https://worker.example/metrics')).status).toBe(403);
      expect(
        (
          await f.fetch('https://worker.example/metrics', {
            headers: { Authorization: `Bearer ${f.env.METRICS_TOKEN}` },
          })
        ).status,
      ).toBe(200);
    },
  );
  it('allows cache hits beyond the shared transform allowance but blocks new transforms', async () => {
    const f = await fixture();
    f.env.MAX_TRANSFORMS_PER_HOUR = '1';
    expect((await f.fetch()).status).toBe(200);
    expect((await f.fetch()).status).toBe(200);
    expect(
      (
        await f.fetch(
          'https://worker.example/_img/v1?key=images/a.png&preset=card&w=320&format=webp',
        )
      ).status,
    ).toBe(429);
  });
  it('times out a stalled native callback without exposing private error data', async () => {
    const f = await fixture({
      config: { timeoutMs: 10 },
      transform: async () => new Promise(() => {}),
    });
    const response = await f.fetch();
    expect(response.status).toBe(504);
    expect(await response.text()).not.toContain('images/a.png');
  });
});

it('validates admin JSON and cf.image origin redirects', async () => {
  const f = await fixture();
  for (const body of ['null', '{', '[]'])
    expect(
      (
        await f.fetch('https://worker.example/purge', {
          method: 'POST',
          headers: { Authorization: `Bearer ${f.env.PURGE_TOKEN}` },
          body,
        })
      ).status,
    ).toBe(400);
  const { cfImageTransform } = await import('../packages/svelte-imageway/src/lib/edge/cf-image.js');
  const { normalizeRequest } = await import('../packages/svelte-imageway/src/lib/core/url.js');
  expect(() => cfImageTransform('http://private/')).toThrow();
  const run = cfImageTransform('https://owned.example', async (url, init) => {
    expect(url).toBe('https://owned.example/images/a.png');
    expect(init.redirect).toBe('manual');
    expect(init.cf.image.width).toBe(640);
    return new Response(null, { status: 302 });
  });
  await expect(
    run(
      normalizeRequest({ key: 'images/a.png', w: 640, format: 'webp' }),
      new Uint8Array(),
      f.env,
      'image/webp',
    ),
  ).rejects.toThrow('redirected');
});

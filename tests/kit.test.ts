import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import {
  defineConfig,
  canonicalQuery,
  signRequest,
} from '../packages/svelte-imageway/src/lib/core/index.js';
import { imageStrategy, imageAdapter } from '../packages/svelte-imageway/src/lib/kit/adapter.js';
import { local } from '../packages/svelte-imageway/src/lib/providers/local.js';
import { cloudflare } from '../packages/svelte-imageway/src/lib/providers/cloudflare.js';
import { vercel } from '../packages/svelte-imageway/src/lib/providers/vercel.js';
import { netlify } from '../packages/svelte-imageway/src/lib/providers/netlify.js';
import { generic } from '../packages/svelte-imageway/src/lib/providers/generic.js';
import { getImageProps } from '../packages/svelte-imageway/src/lib/props.js';
import type { createImageService as Factory } from '../packages/svelte-imageway/src/lib/kit/handler.js';
let root: string;
let createImageService: typeof Factory;
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'imageway-kit-'));
  await writeFile(
    join(root, 'source.png'),
    await sharp({ create: { width: 800, height: 600, channels: 3, background: 'green' } })
      .png()
      .toBuffer(),
  );
  const url = new URL('../packages/svelte-imageway/dist/kit/handler.js', import.meta.url);
  createImageService = (await import(url.href)).createImageService;
});
afterAll(async () => {
  await rm(root, { recursive: true, force: true });
  delete process.env.IMAGEWAY_TEST_KEY;
});
describe('native provider contracts', () => {
  it('uses a shared image request and platform-specific public URLs', () => {
    const r = { url: 'https://images.example/a.png?token=public', w: 640, format: 'webp' as const };
    expect(local().buildUrl({ key: 'source.png', w: 640 })).toContain('preset=card');
    expect(cloudflare({ base: 'https://cdn.example' }).buildUrl(r)).toContain(
      '/cdn-cgi/image/width=640,quality=75,format=webp',
    );
    const n = new URL(netlify({ base: 'https://site.example' }).buildUrl(r));
    expect(n.searchParams.get('fm')).toBe('webp');
    expect(n.searchParams.get('url')).toBe(r.url);
    const v = new URL(vercel({ base: 'https://site.example' }).buildUrl({ ...r, format: 'auto' }));
    expect(v.pathname).toBe('/_vercel/image');
    expect(v.searchParams.get('w')).toBe('640');
    expect(() => vercel().buildUrl(r)).toThrow(/negotiation/);
    expect(() => netlify().buildUrl({ ...r, rotate: 90 })).toThrow(/rotate/);
    expect(() => cloudflare().buildUrl({ ...r, format: 'avif', w: 1920 })).toThrow(/1200/);
    expect(
      generic({ template: 'https://images.example/resize?source={source}&width={w}' }).buildUrl(r),
    ).toContain('width=640');
    expect(() => generic({ template: 'http://insecure/{source}' })).toThrow();
  });
  it('constructs real native adapters with shared configuration defaults', async () => {
    expect((await imageAdapter('vercel')).name).toBe('@sveltejs/adapter-vercel');
    expect((await imageAdapter('static')).name).toBe('@sveltejs/adapter-static');
    await expect(imageAdapter('deno')).rejects.toThrow(/actual verified/);
  });
  it('preserves adapter behavior and rejects impossible deployment combinations', () => {
    expect(imageStrategy({ name: '@sveltejs/adapter-static' }).processing).toBe('build');
    expect(imageStrategy({ name: '@sveltejs/adapter-node' }).persistentDisk).toBe(true);
    expect(imageStrategy({ name: '@sveltejs/adapter-cloudflare' }).processing).toBe('native');
    expect(() => imageStrategy({ name: '@sveltejs/adapter-auto' })).toThrow(/infer/);
    expect(imageStrategy({ name: 'custom' }, 'bun').processing).toBe('sharp');
    expect(() =>
      imageAdapter({ name: '@sveltejs/adapter-cloudflare', adapt() {} }, { provider: 'local' }),
    ).toThrow(/Sharp/);
  });
});
describe('real Fetch runtime', () => {
  it('serves distinct cached formats through one automatically generated component URL', async () => {
    const service = createImageService({
      sourceRoot: root,
      cacheDirectory: join(root, 'auto-cache'),
    });
    const props = getImageProps({ src: '/source.png', alt: '', width: 640, provider: local() });
    expect(props.sources).toEqual([]);
    const url = `https://site.example${props.src}`;
    const webp = await service.fetch(new Request(url, { headers: { Accept: 'image/webp' } }));
    const jpeg = await service.fetch(new Request(url, { headers: { Accept: 'image/jpeg' } }));
    expect(webp.status).toBe(200);
    expect(jpeg.status).toBe(200);
    expect(webp.headers.get('vary')).toContain('Accept');
    expect(jpeg.headers.get('etag')).not.toBe(webp.headers.get('etag'));
    expect((await sharp(Buffer.from(await webp.arrayBuffer())).metadata()).format).toBe('webp');
    expect((await sharp(Buffer.from(await jpeg.arrayBuffer())).metadata()).format).toBe('jpeg');
    const cached = await service.fetch(new Request(url, { headers: { Accept: 'image/webp' } }));
    expect(cached.headers.get('x-imageway-cache')).toBe('HIT');
    const refused = await service.fetch(new Request(url, { headers: { Accept: 'image/unknown' } }));
    expect(refused.status).toBe(406);
  });
  it('serves negotiated bytes with cache validators, correct HEAD and private defaults', async () => {
    const service = createImageService({ sourceRoot: root, cacheDirectory: join(root, 'cache') });
    const url = `https://site.example${local().buildUrl({ key: 'source.png', w: 640 })}`;
    const first = await service.fetch(new Request(url, { headers: { Accept: 'image/webp' } }));
    expect(first.status).toBe(200);
    expect(first.headers.get('content-type')).toBe('image/webp');
    expect(first.headers.get('cache-control')).toBe('private, no-store');
    expect((await sharp(Buffer.from(await first.arrayBuffer())).metadata()).width).toBe(640);
    const second = await service.fetch(
      new Request(url, {
        headers: { Accept: 'image/webp', 'If-None-Match': first.headers.get('etag')! },
      }),
    );
    expect(second.status).toBe(304);
    expect(second.headers.get('x-imageway-cache')).toBe('HIT');
    expect(await second.text()).toBe('');
    const head = await service.fetch(
      new Request(url, { method: 'HEAD', headers: { Accept: 'image/webp' } }),
    );
    expect(head.status).toBe(200);
    expect(await head.text()).toBe('');
    expect((await service.fetch(new Request(url, { method: 'POST' }))).status).toBe(405);
    expect(
      (await service.fetch(new Request('https://site.example/_img/v1?key=../secret&preset=card')))
        .status,
    ).toBe(400);
    expect(
      (
        await service.fetch(
          new Request(
            'https://site.example/_img/v1?url=https%3A%2F%2F169.254.169.254%2Flatest&preset=card',
          ),
        )
      ).status,
    ).toBe(403);
  });
  it('checks signature/expiry before reuse, enforces budget only on cache misses', async () => {
    process.env.IMAGEWAY_TEST_KEY = 'a-32-byte-minimum-test-secret-not-production';
    const service = createImageService({
      sourceRoot: root,
      cacheDirectory: join(root, 'signed-cache'),
      requireSignature: true,
      signingKeys: { current: 'IMAGEWAY_TEST_KEY' },
      maxTransformsPerHour: 1,
      config: defineConfig(),
    });
    const now = Math.floor(Date.now() / 1000);
    const r = await signRequest(
      { key: 'source.png', w: 320, format: 'webp' },
      { secret: process.env.IMAGEWAY_TEST_KEY, kid: 'current', exp: now + 60 },
    );
    const url = 'https://site.example/_img/v1?' + canonicalQuery(r);
    expect((await service.fetch(new Request(url))).status).toBe(200);
    expect((await service.fetch(new Request(url))).status).toBe(200);
    expect((await service.fetch(new Request(url.replace('w=320', 'w=640')))).status).toBe(401);
    const expired = await signRequest(
      { key: 'source.png', w: 320, format: 'webp' },
      { secret: process.env.IMAGEWAY_TEST_KEY, kid: 'current', exp: now - 1 },
    );
    expect(
      (await service.fetch(new Request('https://site.example/_img/v1?' + canonicalQuery(expired))))
        .status,
    ).toBe(401);
    const other = await signRequest(
      { key: 'source.png', w: 640, format: 'webp' },
      { secret: process.env.IMAGEWAY_TEST_KEY, kid: 'current', exp: now + 60 },
    );
    expect(
      (await service.fetch(new Request('https://site.example/_img/v1?' + canonicalQuery(other))))
        .status,
    ).toBe(429);
  });
});

it('never gives a public CDN a TTL beyond a signed request expiry', async () => {
  process.env.IMAGEWAY_TEST_KEY = 'a-public-test-signing-key-at-least-32-bytes';
  const service = createImageService({
    sourceRoot: root,
    cacheDirectory: join(root, 'signed-public'),
    publicSources: true,
    signingKeys: { current: 'IMAGEWAY_TEST_KEY' },
  });
  const signed = await signRequest(
    { key: 'source.png', preset: 'card', format: 'webp' },
    {
      secret: process.env.IMAGEWAY_TEST_KEY,
      kid: 'current',
      exp: Math.floor(Date.now() / 1000) + 15,
    },
  );
  const response = await service.fetch(
    new Request('https://site.example/_img/v1?' + canonicalQuery(signed)),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toMatch(
    /^public, max-age=1[0-5], must-revalidate$/,
  );
  expect(
    (
      await service.fetch(
        new Request('https://site.example/_img/v1?key=source.png&preset=card&exp=0'),
      )
    ).status,
  ).toBe(401);
});

it('supports Save-Data for locked presets with correct cache variation', async () => {
  const service = createImageService({ sourceRoot: root, cacheDirectory: join(root, 'save-data') });
  const r = await service.fetch(
    new Request('https://site.example/_img/v1?key=source.png&preset=og', {
      headers: { 'Save-Data': 'on' },
    }),
  );
  expect(r.status).toBe(200);
  expect(r.headers.get('vary')).toContain('Save-Data');
});

it('counts body bytes once and excludes HEAD and 304 responses', async () => {
  const service = createImageService({
    sourceRoot: root,
    cacheDirectory: join(root, 'metrics-cache'),
  });
  const url = `https://site.example${local().buildUrl({ key: 'source.png', w: 640 })}`;
  const first = await service.fetch(new Request(url, { headers: { Accept: 'image/webp' } }));
  const length = (await first.arrayBuffer()).byteLength;
  expect(service.metrics.bytes).toBe(length);
  const conditional = await service.fetch(
    new Request(url, {
      headers: { Accept: 'image/webp', 'If-None-Match': first.headers.get('etag')! },
    }),
  );
  expect(conditional.status).toBe(304);
  await service.fetch(new Request(url, { method: 'HEAD', headers: { Accept: 'image/webp' } }));
  expect(service.metrics.bytes).toBe(length);
});

import { describe, it, expect } from 'vitest';
import { bunny } from '../packages/svelte-imageway/src/lib/providers/bunny.js';
import { imgix } from '../packages/svelte-imageway/src/lib/providers/imgix.js';
import { cloudinary } from '../packages/svelte-imageway/src/lib/providers/cloudinary.js';
import { imagekit } from '../packages/svelte-imageway/src/lib/providers/imagekit.js';
import { imgproxy } from '../packages/svelte-imageway/src/lib/providers/imgproxy.js';
import { ipx } from '../packages/svelte-imageway/src/lib/providers/ipx.js';
import { supabase } from '../packages/svelte-imageway/src/lib/providers/supabase.js';
import { fastly } from '../packages/svelte-imageway/src/lib/providers/fastly.js';
import { cloudfront } from '../packages/svelte-imageway/src/lib/providers/cloudfront.js';
import { uploadcare } from '../packages/svelte-imageway/src/lib/providers/uploadcare.js';
import { cms, recognizeCms, cmsArtifact } from '../packages/svelte-imageway/src/lib/cms/index.js';
import { createFallback } from '../packages/svelte-imageway/src/lib/providers/fallback.js';
import { getImageProps } from '../packages/svelte-imageway/src/lib/props.js';
const base = 'https://assets.example';
const request = { key: 'photos/a.jpg', w: 640, format: 'webp' as const };
describe('additional provider contracts', () => {
  it.each([
    bunny({ base }),
    imgix({ base }),
    cloudinary({ cloudName: 'demo' }),
    imagekit({ base }),
    imgproxy({ base, allowUnsigned: true }),
    ipx({ base }),
    fastly({ base }),
    cloudfront({ base }),
    uploadcare({ base }),
  ])('$name emits bounded, encoded native URLs and rejects unsupported operations', (p) => {
    const url = p.buildUrl(request);
    expect(url).toContain('640');
    expect(url).toMatch(/^https:\/\//);
    expect(() => p.buildUrl({ ...request, blur: 4 })).toThrow(/blur/);
    expect(() => p.buildUrl({ ...request, key: '../secret' })).toThrow();
  });
  it('maps native formats, dimensions and capability limitations accurately', () => {
    expect(new URL(bunny({ base }).buildUrl(request)).searchParams.get('format')).toBe('webp');
    expect(cloudinary({ cloudName: 'demo' }).buildUrl(request)).toContain(
      '/image/upload/c_limit,w_640,q_75,f_webp/photos/a.jpg',
    );
    expect(imagekit({ base }).buildUrl(request)).toContain('tr=w-640%2Cc-at_max%2Cq-75%2Cf-webp');
    expect(() => imgproxy({ base, allowUnsigned: false })).toThrow(/signed/);
    const s = supabase({ base, bucket: 'public-images' });
    expect(s.capabilities.explicitFormat).toBe(false);
    expect(s.buildUrl({ ...request, format: 'auto' })).toContain(
      '/render/image/public/public-images/photos/a.jpg?width=640',
    );
    expect(() => s.buildUrl(request)).toThrow(/auto/);
    expect(() => imgix({ base }).buildUrl({ url: base + '/a.jpg?s=secret', w: 640 })).toThrow(
      /signed/,
    );
    expect(() =>
      imagekit({ base }).buildUrl({ url: 'https://evil.example/a.jpg', w: 640 }),
    ).toThrow(/belong/);
    expect(uploadcare({ base }).buildUrl(request)).toContain(
      '/-/preview/640x2048/-/quality/normal/',
    );
  });
  it('uses the same headless image call when only configuration changes', () => {
    for (const provider of [
      bunny({ base }),
      cloudfront({ base }),
      cloudinary({ cloudName: 'demo' }),
    ]) {
      const props = getImageProps({
        src: 'photos/a.jpg',
        alt: 'Photo',
        width: 640,
        height: 400,
        config: { provider },
      });
      expect(props.srcset).toContain('640w');
      expect(props.width).toBe(640);
    }
  });
});
describe('CMS integration', () => {
  it.each([
    ['https://cdn.sanity.io/images/p/d/x.jpg', 'sanity'],
    ['https://images.ctfassets.net/p/x.jpg', 'contentful'],
    ['https://a.storyblok.com/f/x.jpg', 'storyblok'],
    ['https://images.prismic.io/p/x.jpg', 'prismic'],
    ['https://www.datocms-assets.com/x.jpg', 'datocms'],
    ['https://cdn.shopify.com/x.jpg', 'shopify'],
    ['https://images.unsplash.com/photo-x?ixid=abc', 'unsplash'],
  ] as const)('recognizes %s without a hostname suffix bypass', (url, kind) => {
    expect(recognizeCms(url)).toBe(kind);
    expect(
      recognizeCms(url.replace(new URL(url).hostname, new URL(url).hostname + '.evil.example')),
    ).toBeUndefined();
  });
  it('preserves Unsplash attribution and CMS crop query parameters', () => {
    const p = cms({ kind: 'unsplash', base: 'https://images.unsplash.com' });
    const u = new URL(
      p.buildUrl({
        url: 'https://images.unsplash.com/photo-1?ixid=attribution',
        w: 640,
        format: 'webp',
      }),
    );
    expect(u.searchParams.get('ixid')).toBe('attribution');
    for (const kind of ['sanity', 'contentful', 'directus', 'storyblok'] as const)
      expect(cms({ kind, base }).buildUrl(request)).toContain('640');
    expect(() =>
      cms({ kind: 'directus', base }).buildUrl({ url: base + '/asset?token=secret', w: 640 }),
    ).toThrow(/signed/);
    expect(() => cms({ kind: 'strapi', base })).toThrow(/pre-generated/);
  });
  it('adapts WordPress/Strapi variant metadata without inventing a resizing endpoint', () => {
    const a = cmsArtifact(
      { url: '/uploads/full.jpg', width: 1200, height: 800 },
      [
        { url: '/uploads/small.jpg', width: 320, height: 213 },
        { url: '/uploads/a.webp', width: 640, height: 427, mime: 'image/webp' },
      ],
      base,
    );
    expect(a.srcset).toContain('small.jpg 320w');
    expect(a.sources[0]?.type).toBe('image/webp');
    expect(a.aspectRatio).toBe(1.5);
    expect(() => cmsArtifact({ url: 'javascript:alert(1)', width: 1, height: 1 })).toThrow();
  });
});
describe('server circuit breaker', () => {
  const p = bunny({ base });
  it('opens on 5xx, skips the open provider and recovers with a probe', async () => {
    let first = 0;
    const fallback = createFallback({
      providers: [p, bunny({ base: 'https://backup.example' })],
      failureThreshold: 1,
      cooldownMs: 10,
      transport: async (url) => {
        if (url.startsWith(base)) {
          first++;
          return new Response(null, { status: first === 1 ? 503 : 200 });
        }
        return new Response('backup');
      },
    });
    expect(await (await fallback.fetch(request)).text()).toBe('backup');
    await fallback.fetch(request);
    expect(first).toBe(1);
    await new Promise((r) => setTimeout(r, 15));
    expect((await fallback.fetch(request)).status).toBe(200);
    expect(first).toBe(2);
  });
  it.each([400, 401, 403, 404, 429])('never bypasses %s with a backup/original', async (status) => {
    const f = createFallback({
      providers: [p, p],
      transport: async () => new Response(null, { status }),
      original: async () => {
        throw new Error('Access bypass');
      },
    });
    expect((await f.fetch(request)).status).toBe(status);
  });
  it('bounds a stalled provider before invoking an explicitly authorized original', async () => {
    const f = createFallback({
      providers: [p],
      timeoutMs: 5,
      transport: async () => new Promise(() => {}),
      original: async () => new Response('authorized original'),
    });
    expect(await (await f.fetch(request)).text()).toBe('authorized original');
  });
});

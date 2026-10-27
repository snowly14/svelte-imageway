import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  getImageProps,
  imageSizes,
  type ImageOptions,
} from '../packages/svelte-imageway/src/lib/props.js';
import { backgroundStyle, cssUrl } from '../packages/svelte-imageway/src/lib/background.js';
import type {
  ImageArtifact,
  ImageProvider,
} from '../packages/svelte-imageway/src/lib/core/types.js';
import type {
  ImageProps,
  PictureProps,
} from '../packages/svelte-imageway/src/lib/component-types.js';
import { local } from '../packages/svelte-imageway/src/lib/providers/local.js';
import {
  registerImageArtifact,
  resolveImageArtifact,
} from '../packages/svelte-imageway/src/lib/core/artifact.js';
const artifact: ImageArtifact = {
  src: '/fallback.png',
  srcset: '/small.png 320w, /large.png 640w',
  sources: [{ type: 'image/avif', srcset: '/small.avif 320w, /large.avif 640w' }],
  width: 640,
  height: 400,
  aspectRatio: 1.6,
  dominantColor: '#ff0000',
  placeholder: 'data:image/webp;base64,YWJj',
};
describe('headless and type contract', () => {
  it('resolves normal URL imports and replaces HMR identities without losing shared originals', () => {
    registerImageArtifact('/registered-original.jpg', artifact, 'module-a');
    registerImageArtifact('/registered-original.jpg', artifact, 'module-b');
    expect(getImageProps({ src: '/registered-original.jpg', alt: '' })).toMatchObject({
      src: artifact.src,
      width: 640,
      height: 400,
    });
    registerImageArtifact('/updated-original.jpg', artifact, 'module-a');
    expect(resolveImageArtifact('/registered-original.jpg')).toBe(artifact);
    registerImageArtifact('/updated-original.jpg', artifact, 'module-b');
    expect(resolveImageArtifact('/registered-original.jpg')).toBeUndefined();
    expect(resolveImageArtifact('/updated-original.jpg')).toBe(artifact);
  });
  it('keeps img presentation separate and rejects picture-only component props', () => {
    const img = {
      ...artifact,
      img: {
        src: '/large.webp',
        srcset: '/small.webp 320w, /large.webp 640w',
        width: 640,
        height: 400,
        type: 'image/webp',
      },
    };
    const native = getImageProps({ src: img, alt: '', formatStrategy: 'img' });
    expect(native.src).toBe('/large.webp');
    expect(native.srcset).toContain('/small.webp');
    expect(native.sources).toEqual([]);
    expect(getImageProps({ src: artifact, alt: '', formatStrategy: 'img' }).src).toBe(artifact.src);
    const picture: PictureProps = { src: artifact, alt: '', sources: artifact.sources };
    expect(picture.sources).toBe(artifact.sources);
    // @ts-expect-error Image never renders picture sources.
    const invalid: ImageProps = { src: artifact, alt: '', sources: artifact.sources };
    // @ts-expect-error Use Picture, rather than changing Image markup through a strategy.
    const strategy: ImageProps = { src: artifact, alt: '', formatStrategy: 'picture' };
    void invalid;
    void strategy;
  });
  it('does not inspect providers for already optimized artifacts', () => {
    const config = {
      get providers(): never {
        throw Error('Unnecessary provider lookup');
      },
    };
    expect(getImageProps({ src: artifact, alt: '', config }).src).toBe(artifact.src);
    registerImageArtifact('/already-built.jpg', artifact, 'provider-fast-path');
    expect(getImageProps({ src: '/already-built.jpg', alt: '', config }).srcset).toBe(
      artifact.srcset,
    );
  });
  it('keeps Image props typed for local imports, dynamic URLs and native events', () => {
    const props: ImageProps = {
      src: artifact,
      alt: '',
      priority: true,
      onload(event) {
        expectTypeOf(event).toExtend<Event>();
        expectTypeOf(event).not.toBeAny();
      },
    };
    expectTypeOf(props.src).toEqualTypeOf<ImageArtifact | string>();
    const dynamic: ImageProps = { src: '/photo.jpg', alt: '' };
    // @ts-expect-error An explicit alt is required for accessibility.
    const missingAlt: ImageProps = { src: artifact };
    const provider: ImageProps = { src: artifact, alt: '', provider: local() };
    void dynamic;
    void missingAlt;
    void provider;
  });
  it('negotiates dynamic local formats automatically, with an explicit picture override', () => {
    const options = { src: '/photo.jpg', alt: 'Photo', provider: local(), width: 800 };
    const automatic = getImageProps(options);
    expect(automatic.sources).toEqual([]);
    expect(automatic.src).not.toMatch(/[?&]f=/);
    expect(automatic.srcset).toContain('800w');
    expect(automatic).not.toHaveProperty('formatStrategy');
    const picture = getImageProps({ ...options, formatStrategy: 'picture' });
    expect(picture.sources.map((source) => source.type)).toContain('image/webp');
    const restricted = getImageProps({ ...options, config: { formats: ['webp'] } });
    expect(restricted.src).toMatch(/webp/);
    const imported = getImageProps({ ...options, src: artifact });
    expect(imported.sources).toEqual(artifact.sources);
    // @ts-expect-error Only supported strategies are accepted.
    const invalid: ImageOptions = { ...options, formatStrategy: 'magic' };
    void invalid;
  });
  it('preserves native callbacks and data attributes without mutating frozen options', () => {
    const onload = () => undefined,
      onerror = () => undefined;
    const options = Object.freeze({
      src: artifact,
      alt: 'Photo',
      formatStrategy: 'img' as const,
      onload,
      onerror,
      'data-photo': 'hero',
    });
    const attributes = getImageProps(options);
    expect(attributes).toMatchObject({ onload, onerror, 'data-photo': 'hero' });
    expect(attributes.sources).toEqual([]);
    attributes.alt = 'Changed';
    expect(options.alt).toBe('Photo');
  });
  it('expands only supported size tokens and keeps reverse-priority media order', () => {
    expect(imageSizes('constructor:20vw sm:100vw toString:25vw md:50vw __proto__:30vw')).toBe(
      '__proto__:30vw, (min-width: 768px) 50vw, toString:25vw, (min-width: 640px) 100vw, constructor:20vw, 100vw',
    );
    expect(imageSizes('sm: md:50vw:ignored xl:25vw')).toBe(
      '(min-width: 1280px) 25vw, (min-width: 768px) 50vw, sm:, 100vw',
    );
    expect(imageSizes('auto, 50vw', false)).toBe('50vw');
  });
  it('reuses the fallback candidate URL without rebuilding or mutating provider requests', () => {
    const calls: Array<{ w?: number; format?: string }> = [];
    const provider: ImageProvider = {
      name: 'counted',
      capabilities: {
        formats: ['jpeg', 'webp'],
        fit: ['inside'],
        animation: false,
        signature: false,
        smartCrop: false,
      },
      validate() {},
      buildUrl(request) {
        calls.push({ ...request });
        return `/photo?w=${request.w}&format=${request.format}&token=${calls.length}`;
      },
    };
    const options = {
      src: 'https://images.example/photo.jpg',
      alt: '',
      width: 640,
      provider,
      config: { widths: [320, 320, 960] },
      formatStrategy: 'img' as const,
    };
    const image = getImageProps(options);
    expect(calls).toHaveLength(2);
    expect(calls.map((c) => c.w)).toEqual([640, 320]);
    expect(image.srcset).toContain(`${image.src} 640w`);
    expect(image.srcset).toContain('320w');
    expect(options.config.widths).toEqual([320, 320, 960]);
    calls.length = 0;
    const picture = getImageProps({ ...options, formatStrategy: 'picture' });
    expect(calls).toHaveLength(4);
    expect(picture.srcset).toContain(`${picture.src} 640w`);
    expect(picture.sources[0]?.type).toBe('image/webp');
    expect(picture.sources[0]?.srcset).toContain('640w');
    expect(calls[0]?.format).toBe('jpeg');
    expect(calls.filter((c) => c.format === 'jpeg' && c.w === 640)).toHaveLength(1);
  });
  it('uses a single checked dominant-colour value and preserves exact style ordering', () => {
    let reads = 0;
    const src = {
      ...artifact,
      get dominantColor() {
        return ++reads < 3 ? '#123456' : 'red;display:none';
      },
    };
    const image = getImageProps({
      src,
      alt: '',
      fit: 'outside',
      position: 'top-left',
      style: 'border:0',
      transitionName: 'hero',
      contentVisibility: 'auto',
    });
    expect(reads).toBe(1);
    expect(image.style).toBe(
      'max-width:100%;height:auto;object-fit:cover;object-position:top left;aspect-ratio:640/400;background-color:#123456;background-image:url("data:image/webp;base64,YWJj");background-size:cover;view-transition-name:hero;content-visibility:auto;border:0',
    );
    expect(image.style).not.toContain('display:none');
  });
  it('requires alt including explicit decorative alt, and derives dimensions safely', () => {
    // @ts-expect-error alt is mandatory even for a raw URL.
    const invalid: ImageOptions = { src: '/photo.png' };
    void invalid;
    // @ts-expect-error Component props also enforce alt.
    const invalidComponent: ImageProps = { src: artifact };
    void invalidComponent;
    expectTypeOf<ImageProps['alt']>().toEqualTypeOf<string>();
    expect(() => getImageProps({ src: artifact } as ImageOptions)).toThrow(/alt/);
    const image = getImageProps({ src: artifact, alt: '', priority: true, sizes: 'auto, 50vw' });
    expect(image).toMatchObject({
      width: 640,
      height: 400,
      loading: 'eager',
      fetchpriority: 'high',
      decoding: 'sync',
      sizes: '50vw',
    });
    expect(image.style).toContain('aspect-ratio:640/400');
    expect(image.sources).toEqual(artifact.sources);
    const hostile = getImageProps({
      src: {
        ...artifact,
        placeholder: 'url("javascript:evil")',
        dominantColor: 'red;display:none',
      },
      alt: 'safe',
    });
    expect(hostile.style).not.toContain('javascript');
    expect(hostile.style).not.toContain('display:none');
    expect(
      getImageProps({ src: artifact, alt: '', placeholder: false }).placeholder,
    ).toBeUndefined();
    expect(imageSizes('sm:100vw md:50vw')).toBe(
      '(min-width: 768px) 50vw, (min-width: 640px) 100vw, 100vw',
    );
  });
  it('selects providers by domain without fetching or requiring window', () => {
    const provider: ImageProvider = {
      name: 'test',
      capabilities: {
        formats: ['avif', 'webp', 'jpeg'],
        fit: ['inside'],
        animation: false,
        signature: false,
        smartCrop: false,
      },
      validate() {},
      buildUrl: (r) => `/proxy?w=${r.w}&format=${r.format}`,
    };
    const remote = getImageProps({
      src: 'https://images.example/a.jpg',
      alt: 'Example',
      width: 640,
      height: 400,
      config: { providers: { 'images.example': provider } },
    });
    expect(remote.src).toBe('/proxy?w=640&format=jpeg');
    expect(remote.sources[0]?.type).toBe('image/avif');
    expect(remote.srcset).toContain('320w');
    expect(
      getImageProps({ src: 'https://constructor/image.jpg', alt: '', config: { providers: {} } })
        .src,
    ).toBe('https://constructor/image.jpg');
    expect(getImageProps({ src: '/original.png', alt: '' }).src).toBe('/original.png');
  });
  it('escapes background raw-text URLs and generates typed image-set with a fallback', () => {
    expect(cssUrl('</style>"')).not.toContain('</style>');
    const css = backgroundStyle(artifact);
    expect(css).toContain('background-image:url("/fallback.png")');
    expect(css).toContain('image-set(');
    expect(css).toContain('type("image/avif")');
  });
});

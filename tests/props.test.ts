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
import type { ImageProps } from '../packages/svelte-imageway/src/lib/component-types.js';
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

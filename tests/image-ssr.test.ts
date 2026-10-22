import { beforeAll, expect, it } from 'vitest';
import { writeFile, mkdir } from 'node:fs/promises';
import { build } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { imageway } from '../packages/svelte-imageway/src/lib/vite/index.js';
import { render } from 'svelte/server';
import type { Component } from 'svelte';
import type {
  ImageProps,
  PictureProps,
} from '../packages/svelte-imageway/src/lib/component-types.js';
let component: Component<ImageProps>;
let picture: Component<PictureProps>;
beforeAll(async () => {
  await mkdir('.local', { recursive: true });
  await writeFile(
    '.local/image-ssr-entry.ts',
    'export {default as Image} from "../packages/svelte-imageway/src/lib/components/Image.svelte"; export {default as Picture} from "../packages/svelte-imageway/src/lib/components/Picture.svelte";',
  );
  await build({
    configFile: false,
    logLevel: 'silent',
    plugins: [imageway(), svelte()],
    build: {
      ssr: '.local/image-ssr-entry.ts',
      outDir: '.local/image-ssr-test',
      rolldownOptions: {
        external: (id) => id === 'svelte' || id.startsWith('svelte/'),
        output: { entryFileNames: 'image.mjs' },
      },
    },
  });
  const bundle = await import(new URL('../.local/image-ssr-test/image.mjs', import.meta.url).href);
  component = bundle.Image;
  picture = bundle.Picture;
});
const image = {
  img: {
    src: '/large.webp',
    srcset: '/small.webp 320w, /large.webp 640w',
    width: 640,
    height: 400,
    type: 'image/webp',
  },
  src: '/large.jpg',
  srcset: '/small.jpg 320w, /large.jpg 640w',
  sources: [{ type: 'image/webp', srcset: '/small.webp 320w, /large.webp 640w' }],
  width: 640,
  height: 400,
  aspectRatio: 1.6,
  placeholder: 'data:image/webp;base64,YWJj',
  dominantColor: '#123456',
};
it('SSR reserves dimensions, escapes alt, and preloads the same responsive source', () => {
  const { body, head } = render(component, {
    props: { src: image, alt: '<script>alert(1)</script>', priority: true, sizes: '50vw' },
  });
  expect(body).toContain('width="640"');
  expect(body).not.toContain('<picture');
  expect(body).not.toContain('<source');
  expect(body).toContain('height="400"');
  expect(body).toContain('loading="eager"');
  expect(body).toContain('&lt;script>');
  expect(body).not.toContain('<script>alert');
  expect(head).toContain('rel="preload"');
  expect(head).toContain('imagesrcset="/small.webp 320w, /large.webp 640w"');
  expect(head).toContain('imagesizes="50vw"');
  expect(head).toContain('href="/large.webp"');
});
it('rejects unsafe preview CSS and allows previews to be disabled', () => {
  const hostile = render(component, {
    props: {
      src: { ...image, placeholder: 'url("javascript:evil")', dominantColor: 'red;display:none' },
      alt: '',
    },
  });
  expect(hostile.body).not.toContain('javascript:evil');
  expect(hostile.body).not.toContain('display:none');
  const disabled = render(component, { props: { src: image, alt: '', placeholder: false } });
  expect(disabled.body).not.toContain('base64');
  expect(disabled.body).toContain('loading="lazy"');
  expect(disabled.head).not.toContain('rel="preload"');
});

it('Picture preserves explicit sources and preloads its first format during SSR', () => {
  const { body, head } = render(picture, {
    props: { src: image, alt: 'Landscape', priority: true },
  });
  expect(body).toContain('<picture>');
  expect(body).toContain('<source');
  expect(body).toContain('type="image/webp"');
  expect(body).toContain('src="/large.jpg"');
  expect(head).toContain('imagesrcset="/small.webp 320w, /large.webp 640w"');
});

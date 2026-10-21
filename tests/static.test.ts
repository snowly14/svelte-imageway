import { beforeAll, expect, it } from 'vitest';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { compile } from 'svelte/compiler';
import { render } from 'svelte/server';
import type { Component } from 'svelte';
import type { StaticImageProps } from '../packages/svelte-imageway/src/lib/static-props.js';
let component: Component<StaticImageProps>;
beforeAll(async () => {
  const source = await readFile(
    'packages/svelte-imageway/src/lib/components/StaticImage.svelte',
    'utf8',
  );
  const { js } = compile(source, { generate: 'server', filename: 'StaticImage.svelte' });
  await mkdir('.local', { recursive: true });
  await writeFile('.local/static-ssr-test.mjs', js.code);
  component = (await import(new URL('../.local/static-ssr-test.mjs', import.meta.url).href))
    .default;
});
const image = {
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
  expect(body).toContain('height="400"');
  expect(body).toContain('loading="eager"');
  expect(body).toContain('&lt;script>');
  expect(body).not.toContain('<script>alert');
  expect(head).toContain('rel="preload"');
  expect(head).toContain('imagesrcset="/small.webp 320w, /large.webp 640w"');
  expect(head).toContain('imagesizes="50vw"');
  expect(head).toContain('type="image/webp"');
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

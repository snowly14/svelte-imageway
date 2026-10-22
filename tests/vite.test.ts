import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { build, createServer } from 'vite';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { parseDirectives } from '../packages/svelte-imageway/src/lib/vite/directives.js';
import { placeholder } from '../packages/svelte-imageway/src/lib/vite/placeholder.js';
import type { imageway as factory } from '../packages/svelte-imageway/src/lib/vite/index.js';
import { defineConfig } from '../packages/svelte-imageway/src/lib/core/config.js';
let root: string;
let imageway: typeof factory;
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'imageway-vite-'));
  const url = new URL('../packages/svelte-imageway/dist/vite/index.js', import.meta.url);
  imageway = (await import(url.href)).imageway;
  await writeFile(
    join(root, 'hero.png'),
    await sharp({ create: { width: 800, height: 600, channels: 3, background: 'orange' } })
      .png()
      .toBuffer(),
  );
  await writeFile(
    join(root, 'index.html'),
    '<html><script type="module" src="/main.js"></script></html>',
  );
  await writeFile(
    join(root, 'main.js'),
    "import hero from './hero.png?import&img&w=400;800&format=webp;jpg'; globalThis.hero=hero;",
  );
});
afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});
describe('import directives and placeholders', () => {
  it('applies configured preview byte/pixel limits instead of a hardcoded decoder budget', async () => {
    const source = await readFile(join(root, 'hero.png'));
    await expect(placeholder(source, 'lqip', defineConfig({ maxInputBytes: 1 }))).rejects.toThrow(
      /byte limit/,
    );
    await expect(placeholder(source, 'lqip', defineConfig({ maxPixels: 1 }))).rejects.toThrow(
      /pixel limit/i,
    );
    expect(await placeholder(source, 'none', defineConfig({ maxPixels: 1 }))).toEqual({});
  });
  it('avoids nearly identical terminal widths only for the automatic ladder', () => {
    expect(parseDirectives('img', 1676).widths).toEqual([320, 480, 640, 768, 960, 1280, 1676]);
    expect(parseDirectives('img&w=1600;1676', 1676).widths).toEqual([1600, 1676]);
    expect(parseDirectives('img', 321).widths).toEqual([320, 321]);
  });
  it('preserves exact build widths, deduplicates and clamps intrinsic dimensions', () => {
    expect(parseDirectives('img&w=800;400;400;1200&format=jpg;webp', 800)).toMatchObject({
      widths: [400, 800],
      formats: ['jpeg', 'webp'],
    });
    expect(parseDirectives('img', 100).widths).toEqual([100]);
  });
  it.each([
    'img&w=NaN',
    'img&w=0',
    'img&w=5000',
    'img&format=bmp',
    'img&q=101',
    'img&placeholder=evil',
    'img&bad=1',
    'img&w=320&w=640',
  ])('rejects invalid directive %s', (query) =>
    expect(() => parseDirectives(query, 800)).toThrow(),
  );
  it.each(['lqip', 'color', 'none', 'thumbhash', 'blurhash'] as const)(
    'produces a server-generated %s preview without a browser decoder',
    async (strategy) => {
      const result = await placeholder(await readFile(join(root, 'hero.png')), strategy);
      if (strategy === 'none') expect(result.dominantColor).toBeUndefined();
      else expect(result.dominantColor).toMatch(/^#[a-f\d]{6}$/);
      if (!['color', 'none'].includes(strategy)) {
        expect(result.placeholder).toMatch(/^data:image\//);
        const decoded = Buffer.from(result.placeholder!.split(',')[1]!, 'base64');
        expect((await sharp(decoded).metadata()).width).toBeGreaterThan(0);
      }
      if (strategy === 'lqip')
        expect(Buffer.from(result.placeholder!.split(',')[1]!, 'base64').length).toBeLessThan(1024);
    },
  );
});
describe('real Vite build and dev', () => {
  it('serves ordinary imports lazily beneath a non-root dev base and preserves original bytes', async () => {
    await rm(join(root, 'node_modules/.cache/svelte-imageway'), { recursive: true, force: true });
    const server = await createServer({
      root,
      base: '/nested/',
      configFile: false,
      logLevel: 'silent',
      resolve: {
        alias: {
          'svelte-imageway/core': fileURLToPath(
            new URL('../packages/svelte-imageway/dist/core/index.js', import.meta.url),
          ),
        },
      },
      plugins: [imageway()],
      server: { port: 0 },
    });
    try {
      await server.listen();
      const port = (server.httpServer!.address() as { port: number }).port;
      const base = `http://localhost:${port}`;
      const response = await fetch(base + '/nested/hero.png?import');
      expect(response.status).toBe(200);
      const code = await response.text();
      const original = code.match(/const original\s*=\s*"([^"]+)"/)![1]!;
      expect(original).toMatch(/^\/nested\/@imageway\//);
      const raw = await fetch(base + original);
      expect(raw.headers.get('content-type')).toBe('image/png');
      expect(Buffer.from(await raw.arrayBuffer())).toEqual(await readFile(join(root, 'hero.png')));
      await expect(readdir(join(root, 'node_modules/.cache/svelte-imageway'))).rejects.toThrow();
      const variant = code.match(/(\/nested\/@imageway\/[a-f\d]+\.webp) 320w/)![1]!;
      const optimized = await fetch(base + variant);
      expect(optimized.headers.get('content-type')).toBe('image/webp');
      expect((await sharp(Buffer.from(await optimized.arrayBuffer())).metadata()).width).toBe(320);
    } finally {
      await server.close();
    }
  });
  it('keeps ordinary imports as original URLs and registers responsive metadata in production', async () => {
    const { runInNewContext } = await import('node:vm');
    const entry = join(root, 'ordinary.js');
    await writeFile(
      entry,
      "import image from './hero.png'; import {resolveImageArtifact} from 'svelte-imageway/core'; globalThis.result={image,artifact:resolveImageArtifact(image)};",
    );
    await build({
      root,
      configFile: false,
      logLevel: 'silent',
      base: '/nested/',
      resolve: {
        alias: {
          'svelte-imageway/core': fileURLToPath(
            new URL('../packages/svelte-imageway/dist/core/index.js', import.meta.url),
          ),
        },
      },
      plugins: [imageway({ config: { widths: [320, 800], formats: ['webp', 'jpeg'] } })],
      build: { outDir: 'ordinary', minify: false, rolldownOptions: { input: entry } },
    });
    const scripts = await readdir(join(root, 'ordinary/assets'));
    const code = await readFile(
      join(
        root,
        'ordinary/assets',
        scripts.find((f) => f.endsWith('.js'))!,
      ),
      'utf8',
    );
    const context = {
      URL,
      document: { baseURI: 'https://example.test/nested/' },
      location: { href: 'https://example.test/nested/' },
      result: undefined as
        | undefined
        | {
            image: string;
            artifact: import('../packages/svelte-imageway/src/lib/core/types.js').ImageArtifact;
          },
    };
    runInNewContext(code, context);
    const { image, artifact } = context.result!;
    expect(typeof image).toBe('string');
    expect(image).toContain('/nested/imageway/');
    expect(artifact).toMatchObject({ width: 800, height: 600, img: { type: 'image/webp' } });
    expect(artifact.img!.srcset).toContain('320w');
    expect(
      await readFile(
        join(
          root,
          'ordinary',
          new URL(image, 'https://example.test').pathname.replace('/nested/', ''),
        ),
      ),
    ).toEqual(await readFile(join(root, 'hero.png')));
    expect(code).not.toMatch(/node:|sharp|ROLLUP_FILE_URL/);
  });
  it('preserves explicit native URL imports and the automatic-import opt-out', async () => {
    for (const autoImports of [true, false]) {
      const server = await createServer({
        root,
        configFile: false,
        logLevel: 'silent',
        plugins: [imageway({ autoImports })],
        resolve: {
          alias: {
            'svelte-imageway/core': fileURLToPath(
              new URL('../packages/svelte-imageway/dist/core/index.js', import.meta.url),
            ),
          },
        },
        server: { middlewareMode: true },
      });
      try {
        const native = await server.transformRequest('/hero.png?url');
        expect(native?.code).not.toContain('registerImageArtifact');
        const ordinary = await server.transformRequest('/hero.png');
        expect(ordinary?.code.includes('registerImageArtifact')).toBe(autoImports);
      } finally {
        await server.close();
      }
    }
  });
  it('deduplicates actual srcset widths when a height constraint collapses requested sizes', async () => {
    const entry = join(root, 'height-entry.js');
    await writeFile(
      entry,
      "import image from './hero.png?w=320;640&h=100&fit=inside&format=webp&placeholder=none&img'; console.log(image);",
    );
    await build({
      root,
      configFile: false,
      logLevel: 'silent',
      plugins: [imageway()],
      build: { outDir: 'height-limited', minify: false, rolldownOptions: { input: entry } },
    });
    const scripts = await readdir(join(root, 'height-limited/assets'));
    const code = await readFile(
      join(
        root,
        'height-limited/assets',
        scripts.find((file) => file.endsWith('.js'))!,
      ),
      'utf8',
    );
    expect(code.match(/133w/g)).toHaveLength(1);
    expect((await readdir(join(root, 'height-limited/imageway'))).length).toBe(1);
  });
  it('enforces the output byte limit for optimized SVG imports', async () => {
    await writeFile(
      join(root, 'small.svg'),
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="red"/></svg>',
    );
    const entry = join(root, 'svg-entry.js');
    await writeFile(
      entry,
      "import image from './small.svg?format=svg&placeholder=none&img'; console.log(image);",
    );
    await expect(
      build({
        root,
        configFile: false,
        logLevel: 'silent',
        plugins: [imageway({ config: { maxOutputBytes: 1 } })],
        build: { outDir: 'svg-budget', rolldownOptions: { input: entry } },
      }),
    ).rejects.toThrow(/byte limit/);
  });
  it('omits default AVIF only when matching WebP variants are no larger, with an opt-out', async () => {
    const entry = join(root, 'prune.js');
    await writeFile(
      entry,
      "import hero from './hero.png?w=320&placeholder=none&img'; console.log(hero);",
    );
    for (const pruneLargerFormats of [false, true]) {
      const outDir = `prune-${pruneLargerFormats}`;
      await build({
        root,
        configFile: false,
        logLevel: 'silent',
        plugins: [imageway({ pruneLargerFormats })],
        build: { outDir, rolldownOptions: { input: entry } },
      });
    }
    const full = await readdir(join(root, 'prune-false/imageway'));
    const pruned = await readdir(join(root, 'prune-true/imageway'));
    const avif = full.find((file) => file.endsWith('.avif'))!;
    const webp = full.find((file) => file.endsWith('.webp'))!;
    const avifBytes = (await readFile(join(root, 'prune-false/imageway', avif))).length;
    const webpBytes = (await readFile(join(root, 'prune-false/imageway', webp))).length;
    expect(pruned.some((file) => file.endsWith('.avif'))).toBe(avifBytes < webpBytes);
    expect(pruned.some((file) => file.endsWith('.jpeg'))).toBe(true);
    expect(await readFile(join(root, 'prune-true/imageway', webp))).toEqual(
      await readFile(join(root, 'prune-false/imageway', webp)),
    );
    // Explicit format directives retain all requested formats even if one is larger.
    await writeFile(
      entry,
      "import hero from './hero.png?w=320&format=avif;webp&placeholder=none&img'; console.log(hero);",
    );
    await build({
      root,
      configFile: false,
      logLevel: 'silent',
      plugins: [imageway()],
      build: { outDir: 'prune-explicit', rolldownOptions: { input: entry } },
    });
    expect((await readdir(join(root, 'prune-explicit/imageway'))).length).toBe(2);
  });
  it('does not turn default formats into an explicit browser allowlist', async () => {
    for (const formats of [undefined, ['webp'] as const]) {
      const server = await createServer({
        root,
        configFile: false,
        logLevel: 'silent',
        plugins: [imageway({ config: formats ? { formats } : {} })],
        server: { middlewareMode: true },
      });
      try {
        const result = await server.transformRequest('virtual:imageway/config');
        expect(result?.code).toContain(formats ? 'formats:["webp"]' : 'formats:undefined');
      } finally {
        await server.close();
      }
    }
  });
  it('emits hashed exact variants and a serializable browser-only artifact with valid URLs', async () => {
    await build({
      root,
      configFile: false,
      logLevel: 'silent',
      plugins: [imageway()],
      build: { outDir: 'dist', minify: false },
    });
    const files = await readdir(join(root, 'dist/imageway'));
    expect(files).toHaveLength(4);
    for (const file of files) {
      expect(file).toMatch(/^[a-f\d]{64}\.(webp|jpeg)$/);
      const meta = await sharp(await readFile(join(root, 'dist/imageway', file))).metadata();
      expect([400, 800]).toContain(meta.width);
    }
    const scripts = await readdir(join(root, 'dist/assets'));
    const code = await readFile(
      join(
        root,
        'dist/assets',
        scripts.find((v) => v.endsWith('.js'))!,
      ),
      'utf8',
    );
    expect(code).not.toMatch(/node:|sharp|worker_threads|SIGNING|__[A-Z]*IMAGEWAY|ROLLUP_FILE_URL/);
    expect(code).toContain('400w');
    expect(code).toContain('/imageway/');
  });
  it('starts without generating images, lazily serves variants, and updates their content identity after changes', async () => {
    await rm(join(root, 'node_modules/.cache/svelte-imageway'), { recursive: true, force: true });
    let imports = 0;
    const server = await createServer({
      root,
      configFile: false,
      logLevel: 'silent',
      plugins: [imageway({ onProgress: () => imports++ })],
      server: { port: 0 },
    });
    try {
      await server.listen();
      expect(imports).toBe(0);
      const address = server.httpServer!.address() as { port: number };
      const base = `http://localhost:${address.port}`;
      const first = await fetch(`${base}/hero.png?import&img&w=400;800&format=webp`);
      const module = await first.text();
      expect(first.status).toBe(200);
      expect(imports).toBe(1);
      await expect(readdir(join(root, 'node_modules/.cache/svelte-imageway'))).rejects.toThrow();
      const url = module.match(/(\/@imageway\/[a-f\d]+\.webp) 400w/)![1]!;
      const image = await fetch(base + url);
      expect(image.headers.get('content-type')).toBe('image/webp');
      expect((await sharp(Buffer.from(await image.arrayBuffer())).metadata()).width).toBe(400);
      const changed = await sharp({
        create: { width: 800, height: 600, channels: 3, background: 'blue' },
      })
        .png()
        .toBuffer();
      const update = new Promise<void>((resolve) => server.watcher.once('change', () => resolve()));
      await writeFile(join(root, 'hero.png'), changed);
      await update;
      await vi.waitFor(async () => {
        const second = await (
          await fetch(`${base}/hero.png?import&img&w=400;800&format=webp&t=${Date.now()}`)
        ).text();
        expect(second).not.toContain(url);
        expect(second).toContain('/@imageway/');
      });
      expect((await fetch(base + url, { method: 'POST' })).status).toBe(405);
    } finally {
      await server.close();
    }
  });
});
describe('actual TypeScript consumer imports', () => {
  it('types canonical imports directly from the package without generated files', async () => {
    const { symlink, mkdir } = await import('node:fs/promises');
    const { execFileSync } = await import('node:child_process');
    const consumer = join(root, 'consumer.ts');
    await writeFile(
      consumer,
      "import type { ImageArtifact } from 'svelte-imageway/core'; import image from './hero.png?w=400;800&format=webp;jpg&img'; const typed: ImageArtifact = image; void typed; const width: number = image.width; void width;",
    );
    await mkdir(join(root, 'node_modules'), { recursive: true });
    await symlink(
      fileURLToPath(new URL('../packages/svelte-imageway', import.meta.url)),
      join(root, 'node_modules/svelte-imageway'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    const compiler = fileURLToPath(new URL('../node_modules/typescript/bin/tsc', import.meta.url));
    const args = [
      compiler,
      '--ignoreConfig',
      '--noEmit',
      '--skipLibCheck',
      '--module',
      'esnext',
      '--moduleResolution',
      'bundler',
      '--target',
      'es2022',
      consumer,
    ];
    execFileSync('node', args, { stdio: 'pipe' });
    await expect(readFile(join(root, 'imageway-env.d.ts'), 'utf8')).rejects.toThrow();
    await expect(readFile(join(root, 'src/imageway-env.d.ts'), 'utf8')).rejects.toThrow();
    await writeFile(
      consumer,
      "import type { ImageArtifact } from 'svelte-imageway/core'; import image from './hero.png?w=400;800&format=webp;jpg&img'; const typed: ImageArtifact = image; void typed; const width: string = image.width; void width;",
    );
    expect(() => execFileSync('node', args, { stdio: 'pipe' })).toThrow();
    await writeFile(
      consumer,
      "import type { ImageArtifact } from 'svelte-imageway/core'; import wrong from './missing.txt?unrelated'; const image: ImageArtifact = wrong; void image;",
    );
    expect(() => execFileSync('node', args, { stdio: 'pipe' })).toThrow();
  });
});

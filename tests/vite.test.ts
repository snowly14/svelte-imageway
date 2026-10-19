import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { build, createServer } from 'vite';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { parseDirectives } from '../packages/svelte-imageway/src/lib/vite/directives.js';
import { placeholder } from '../packages/svelte-imageway/src/lib/vite/placeholder.js';
import type { imageway as factory } from '../packages/svelte-imageway/src/lib/vite/index.js';
let root: string; let imageway: typeof factory;
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'imageway-vite-'));
  const url = new URL('../packages/svelte-imageway/dist/vite/index.js', import.meta.url); imageway = (await import(url.href)).imageway;
  await writeFile(join(root, 'hero.png'), await sharp({ create: { width: 800, height: 600, channels: 3, background: 'orange' } }).png().toBuffer());
  await writeFile(join(root, 'index.html'), '<html><script type="module" src="/main.js"></script></html>');
  await writeFile(join(root, 'main.js'), "import hero from './hero.png?import&img&w=400;800&format=webp;jpg'; globalThis.hero=hero;");
});
afterAll(async () => { await rm(root, { recursive: true, force: true }); });
describe('import directives and placeholders', () => {
  it('preserves exact build widths, deduplicates and clamps intrinsic dimensions', () => {
    expect(parseDirectives('img&w=800;400;400;1200&format=jpg;webp', 800)).toMatchObject({ widths: [400, 800], formats: ['jpeg', 'webp'] });
    expect(parseDirectives('img', 100).widths).toEqual([100]);
  });
  it.each(['img&w=NaN', 'img&w=0', 'img&w=5000', 'img&format=bmp', 'img&q=101', 'img&placeholder=evil', 'img&bad=1', 'img&w=320&w=640'])('rejects invalid directive %s', query => expect(() => parseDirectives(query, 800)).toThrow());
  it.each(['lqip', 'color', 'none', 'thumbhash', 'blurhash'] as const)('produces a server-generated %s preview without a browser decoder', async strategy => {
    const result = await placeholder(await readFile(join(root, 'hero.png')), strategy);
    expect(result.dominantColor).toMatch(/^#[a-f\d]{6}$/);
    if (!['color', 'none'].includes(strategy)) { expect(result.placeholder).toMatch(/^data:image\//); const decoded = Buffer.from(result.placeholder!.split(',')[1]!, 'base64'); expect((await sharp(decoded).metadata()).width).toBeGreaterThan(0); }
    if (strategy === 'lqip') expect(Buffer.from(result.placeholder!.split(',')[1]!, 'base64').length).toBeLessThan(1024);
  });
});
describe('real Vite build and dev', () => {
  it('emits hashed exact variants and a serializable browser-only artifact with valid URLs', async () => {
    await build({ root, configFile: false, logLevel: 'silent', plugins: [imageway()], build: { outDir: 'dist', minify: false } });
    const files = await readdir(join(root, 'dist/imageway')); expect(files).toHaveLength(4);
    for (const file of files) { expect(file).toMatch(/^[a-f\d]{64}\.(webp|jpeg)$/); const meta = await sharp(await readFile(join(root, 'dist/imageway', file))).metadata(); expect([400, 800]).toContain(meta.width); }
    const scripts = await readdir(join(root, 'dist/assets')); const code = await readFile(join(root, 'dist/assets', scripts.find(v => v.endsWith('.js'))!), 'utf8');
    expect(code).not.toMatch(/node:|sharp|worker_threads|SIGNING|__[A-Z]*IMAGEWAY|ROLLUP_FILE_URL/);
    expect(code).toContain('400w'); expect(code).toContain('/imageway/');
  });
  it('starts without generating images, lazily serves variants, and updates their content identity after changes', async () => {
    await rm(join(root, 'node_modules/.cache/svelte-imageway'), { recursive: true, force: true });
    let imports = 0;
    const server = await createServer({ root, configFile: false, logLevel: 'silent', plugins: [imageway({ onProgress: () => imports++ })], server: { port: 0 } });
    try {
      await server.listen(); expect(imports).toBe(0);
      const address = server.httpServer!.address() as { port: number }; const base = `http://localhost:${address.port}`;
      const first = await fetch(`${base}/hero.png?import&img&w=400;800&format=webp`); const module = await first.text(); expect(first.status).toBe(200); expect(imports).toBe(1);
      await expect(readdir(join(root, 'node_modules/.cache/svelte-imageway'))).rejects.toThrow();
      const url = module.match(/(\/@imageway\/[a-f\d]+\.webp) 400w/)![1]!;
      const image = await fetch(base + url); expect(image.headers.get('content-type')).toBe('image/webp'); expect((await sharp(Buffer.from(await image.arrayBuffer())).metadata()).width).toBe(400);
      const changed = await sharp({ create: { width: 800, height: 600, channels: 3, background: 'blue' } }).png().toBuffer();
      const update = new Promise<void>(resolve => server.watcher.once('change', () => resolve())); await writeFile(join(root, 'hero.png'), changed); await update;
      await vi.waitFor(async () => {
        const second = await (await fetch(`${base}/hero.png?import&img&w=400;800&format=webp&t=${Date.now()}`)).text();
        expect(second).not.toContain(url); expect(second).toContain('/@imageway/');
      });
      expect((await fetch(base + url, { method: 'POST' })).status).toBe(405);
    } finally { await server.close(); }
  });
});
describe('actual TypeScript consumer imports', () => {
  it('generates specific directive types and preserves their numeric fields', async () => {
    const { symlink, mkdir } = await import('node:fs/promises');
    const { execFileSync } = await import('node:child_process');
    const { generateImageTypes } = await import('../packages/svelte-imageway/src/lib/vite/typegen.js');
    const consumer = join(root, 'consumer.ts');
    await writeFile(consumer, "import image from './hero.png?img&w=400;800&format=webp;jpg'; const width: number = image.width; void width;");
    await mkdir(join(root, 'node_modules'), { recursive: true });
    await symlink(new URL('../packages/svelte-imageway', import.meta.url).pathname, join(root, 'node_modules/svelte-imageway'));
    const env = await generateImageTypes(root);
    const compiler = new URL('../node_modules/typescript/bin/tsc', import.meta.url).pathname;
    const args = [compiler, '--ignoreConfig', '--noEmit', '--skipLibCheck', '--module', 'esnext', '--moduleResolution', 'bundler', '--target', 'es2022', consumer, env];
    execFileSync('node', args, { stdio: 'pipe' });
    await writeFile(consumer, "import image from './hero.png?img&w=400;800&format=webp;jpg'; const width: string = image.width; void width;");
    expect(() => execFileSync('node', args, { stdio: 'pipe' })).toThrow();
  });
});

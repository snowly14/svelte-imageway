import { build } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { imageway } from '../../packages/svelte-imageway/dist/vite/index.js';
import { enhancedImages } from '@sveltejs/enhanced-img';
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { corpus, root, digest, environment, save, summary } from './common.ts';

export async function browserBench() {
  const env = await environment();
  const fixtures = ['kodim01.png', 'kodim13.png', 'kodim23.png'];
  const modes = [
    'imageway-image',
    'imageway-picture',
    'native-responsive',
    'native-original',
    'enhanced-img',
  ];
  const generated: Array<{
    fixture: string;
    mode: string;
    directory: string;
    htmlBytes: number;
    jsGzipBytes: number;
  }> = [];
  for (const fixture of fixtures) {
    let native = '';
    let nativeHead = '';
    for (const mode of modes) {
      const directory = join(root, 'browser', fixture, mode);
      await mkdir(directory, { recursive: true });
      await cp(join(corpus, fixture), join(directory, 'hero.png'));
      let code = '';
      if (mode.startsWith('imageway'))
        code = `<script>import { ${mode === 'imageway-image' ? 'Image' : 'Picture'} as Photo } from 'svelte-imageway';import photo from './hero.png';</script><Photo src={photo} alt="Kodak photograph" priority sizes="100vw" />`;
      else if (mode === 'enhanced-img')
        code =
          '<script>import photo from "./hero.png?enhanced&w=256;384;512;768&format=webp&quality=75";</script><svelte:head><link rel="preload" as="image" href={photo.img.src} imagesrcset={photo.sources.webp} imagesizes="100vw" fetchpriority="high" /></svelte:head><enhanced:img src={photo} sizes="100vw" alt="Kodak photograph" loading="eager" decoding="async" fetchpriority="high" />';
      else if (mode === 'native-responsive')
        code = `<svelte:head>${nativeHead}</svelte:head>${native}`;
      else {
        const metadata = await sharp(join(corpus, fixture)).metadata();
        code = `<svelte:head><link rel="preload" as="image" href="/original.png" fetchpriority="high" /></svelte:head><img src="/original.png" alt="Kodak photograph" width="${metadata.width}" height="${metadata.height}" loading="eager" decoding="async" fetchpriority="high" />`;
      }
      await writeFile(
        join(directory, 'App.svelte'),
        `${code}<style>:global(body){margin:0;background:#fff;font-family:system-ui}:global(img){display:block;width:100%;height:auto}</style>`,
      );
      await writeFile(
        join(directory, 'main.js'),
        'import {hydrate} from "svelte";import App from "./App.svelte";hydrate(App,{target:document.getElementById("app")});',
      );
      await writeFile(
        join(directory, 'ssr.js'),
        'import {render} from "svelte/server";import App from "./App.svelte";export function page(){return render(App)}',
      );
      await writeFile(
        join(directory, 'index.html'),
        '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Photographic loading benchmark</title></head><body><div id="app"></div><script type="module" src="/main.js"></script></body></html>',
      );
      for (const ssr of [false, true]) {
        await build({
          root: directory,
          configFile: false,
          logLevel: 'silent',
          resolve: {
            alias: [
              {
                find: /^svelte-imageway\/core$/,
                replacement: resolve('packages/svelte-imageway/dist/core/index.js'),
              },
              {
                find: /^svelte-imageway$/,
                replacement: resolve('packages/svelte-imageway/dist/index.js'),
              },
            ],
          },
          plugins: [
            mode === 'enhanced-img'
              ? enhancedImages()
              : imageway({
                  config: {
                    widths: [256, 384, 512, 768],
                    formats: ['webp', 'jpeg'],
                    quality: 75,
                    placeholder: 'none',
                  },
                }),
            svelte(),
          ],
          ssr: { noExternal: ['svelte-imageway'] },
          build: {
            outDir: ssr ? 'ssr' : 'dist',
            ssr: ssr ? 'ssr.js' : undefined,
            assetsInlineLimit: 0,
          },
        });
      }
      const { page } = (await import(pathToFileURL(join(directory, 'ssr/ssr.js')).href)) as {
        page: () => { body: string; head: string };
      };
      const rendered = page();
      if (mode === 'imageway-image') {
        native = rendered.body.match(/<img\b[^>]*>/)?.[0] ?? '';
        nativeHead = rendered.head.match(/<link\b[^>]*>/)?.[0] ?? '';
        if (!native || !nativeHead) throw Error('Expected SSR image and preload.');
      }
      const html = (await readFile(join(directory, 'dist/index.html'), 'utf8'))
        .replace('<div id="app"></div>', `<div id="app">${rendered.body}</div>`)
        .replace('</head>', `${rendered.head}</head>`);
      await writeFile(join(directory, 'dist/index.html'), html);
      await cp(join(corpus, fixture), join(directory, 'dist/original.png'));
      if (mode === 'native-responsive')
        await cp(
          join(root, 'browser', fixture, 'imageway-image/dist/imageway'),
          join(directory, 'dist/imageway'),
          { recursive: true },
        );
      const { readdir } = await import('node:fs/promises');
      let jsGzipBytes = 0;
      for (const name of await readdir(join(directory, 'dist/assets')))
        if (name.endsWith('.js'))
          jsGzipBytes += gzipSync(await readFile(join(directory, 'dist/assets', name))).length;
      generated.push({ fixture, mode, directory, htmlBytes: Buffer.byteLength(html), jsGzipBytes });
    }
  }
  const served = new Map<string, { bytes: Buffer; type: string; encoded: boolean }>();
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url!, 'http://localhost');
      const [fixture, mode, ...parts] = url.pathname.slice(1).split('/');
      const entry = generated.find((g) => g.fixture === fixture && g.mode === mode);
      if (!entry) throw Error('Unknown fixture.');
      const suffix = parts.join('/') || 'index.html';
      const filename = resolve(entry.directory, 'dist', suffix);
      if (!filename.startsWith(resolve(entry.directory, 'dist') + sep))
        throw Error('Invalid path.');
      let cached = served.get(filename);
      if (!cached) {
        const type =
          (
            {
              '.html': 'text/html',
              '.js': 'text/javascript',
              '.css': 'text/css',
              '.webp': 'image/webp',
              '.jpeg': 'image/jpeg',
              '.jpg': 'image/jpeg',
              '.png': 'image/png',
            } as Record<string, string>
          )[extname(filename)] ?? 'application/octet-stream';
        let bytes = await readFile(filename);
        // Vite emits root-relative asset URLs; give every isolated case its own URL prefix.
        if (type.startsWith('text/'))
          bytes = Buffer.from(
            bytes
              .toString()
              .replaceAll('/assets/', `/${fixture}/${mode}/assets/`)
              .replaceAll('/imageway/', `/${fixture}/${mode}/imageway/`)
              .replaceAll('/original.png', `/${fixture}/${mode}/original.png`),
          );
        const encoded = type.startsWith('text/');
        cached = { bytes: encoded ? gzipSync(bytes) : bytes, type, encoded };
        served.set(filename, cached);
      }
      res.writeHead(200, {
        'Content-Type': cached.type,
        'Content-Length': cached.bytes.length,
        'Cache-Control': 'public,max-age=3600',
        ...(cached.encoded ? { 'Content-Encoding': 'gzip' } : {}),
      });
      res.end(cached.bytes);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const port = (server.address() as { port: number }).port;
  const browser = await chromium.launch();
  const rows: Array<{
    round: number;
    fixture: string;
    mode: string;
    cache: string;
    lcpMs: number;
    cls: number;
    imageRequests: number;
    imageBytes: number;
    imageTransferBytes: number;
    resourceTransferBytes: number;
    imageSha256: string;
    selectedWidth: number;
    pageErrors: string[];
  }> = [];
  const expected = new Map<string, string>();
  try {
    for (let round = 0; round < 7; round++)
      for (const fixture of fixtures) {
        const rotated = [
          ...modes.slice(round % modes.length),
          ...modes.slice(0, round % modes.length),
        ];
        for (const mode of round % 2 ? rotated.reverse() : rotated) {
          const context = await browser.newContext({
            viewport: { width: 390, height: 844 },
            deviceScaleFactor: 2,
            isMobile: true,
          });
          try {
            const page = await context.newPage();
            const errors: string[] = [];
            page.on('pageerror', (error) => errors.push(error.message));
            const cdp = await context.newCDPSession(page);
            await cdp.send('Network.enable');
            await cdp.send('Network.emulateNetworkConditions', {
              offline: false,
              latency: 100,
              downloadThroughput: 1_600_000 / 8,
              uploadThroughput: 750_000 / 8,
            });
            await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
            await page.addInitScript(() => {
              const metrics = { lcp: 0, cls: 0 };
              Object.assign(window, { benchMetrics: metrics });
              new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) metrics.lcp = entry.startTime;
              }).observe({ type: 'largest-contentful-paint', buffered: true });
              new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                  const shift = entry as PerformanceEntry & {
                    value: number;
                    hadRecentInput: boolean;
                  };
                  if (!shift.hadRecentInput) metrics.cls += shift.value;
                }
              }).observe({ type: 'layout-shift', buffered: true });
            });
            for (const cache of ['cold', 'warm']) {
              await page.goto(`http://127.0.0.1:${port}/${fixture}/${mode}/`, {
                waitUntil: 'networkidle',
              });
              await page.waitForFunction(() => {
                const img = document.querySelector('img');
                return img?.complete && img.naturalWidth > 0;
              });
              const metrics = await page.evaluate(() => {
                const image = document.querySelector('img')!;
                const resources = performance.getEntriesByType(
                  'resource',
                ) as PerformanceResourceTiming[];
                const images = resources.filter((r) => /\.(png|webp|jpe?g)(?:$|\?)/.test(r.name));
                return {
                  ...(window as unknown as { benchMetrics: { lcp: number; cls: number } })
                    .benchMetrics,
                  currentSrc: image.currentSrc,
                  images: images.map((r) => ({
                    url: r.name,
                    bytes: r.encodedBodySize,
                    transfer: r.transferSize,
                  })),
                  totalTransfer: resources.reduce((n, r) => n + r.transferSize, 0),
                };
              });
              // Read the served file without another measured network request.
              const path = new URL(metrics.currentSrc).pathname.split('/').slice(3).join('/');
              const selected = await readFile(join(root, 'browser', fixture, mode, 'dist', path));
              const sha256 = digest(selected);
              if (mode !== 'native-original') {
                expected.set(fixture, expected.get(fixture) ?? sha256);
                if (expected.get(fixture) !== sha256)
                  throw Error(`Browser selected different encoded pixels: ${mode}`);
              }
              if (!metrics.lcp || metrics.images.length !== 1 || errors.length)
                throw Error(`Invalid browser run ${mode}: ${JSON.stringify({ metrics, errors })}`);
              rows.push({
                round,
                fixture,
                mode,
                cache,
                lcpMs: metrics.lcp,
                cls: metrics.cls,
                imageRequests: metrics.images.length,
                imageBytes: selected.length,
                imageTransferBytes: metrics.images.reduce((n, r) => n + r.transfer, 0),
                resourceTransferBytes: metrics.totalTransfer,
                imageSha256: sha256,
                selectedWidth: (await sharp(selected).metadata()).width!,
                pageErrors: [...errors],
              });
              await save('browser', {
                environment: env,
                browser: browser.version(),
                protocol:
                  'Seven interleaved rounds × three photographs × five SSR/hydrated Svelte cases. Fresh Chromium context per cold/warm pair; second navigation uses browser HTTP cache. Mobile 390x844 DPR2, CDP applied 100ms latency, 1.6Mbps download, 750Kbps upload, 4x CPU slowdown. Gzip HTML/JS/CSS, cache max-age=3600. Every case eager/high priority with preload and explicit dimensions; optimized cases must request one identical WebP by SHA-256. Imageway uses ordinary imports and explicit shared plugin settings (256/384/512/768, WebP+JPEG, q75, no placeholder); enhanced-img uses WebP q75 and same widths. Native responsive markup is extracted from Image SSR then compiled as a native Svelte element. Native original has the same layout/priority, loads lossless PNG. Resource transfer excludes the document. OS/host and Chromium scheduling are uncontrolled. No Next.js, service/CDN or production-site claim.',
                generated: generated.map(({ directory, ...row }) => {
                  void directory;
                  return row;
                }),
                rows,
              });
            }
            console.log(`browser ${round + 1}/7 ${fixture} ${mode}`);
          } finally {
            await context.close();
          }
        }
      }
  } finally {
    await browser.close();
    await new Promise<void>((done) => server.close(() => done()));
  }
  const summaries = fixtures.flatMap((fixture) =>
    modes.flatMap((mode) =>
      ['cold', 'warm'].map((cache) => {
        const selected = rows.filter(
          (r) => r.fixture === fixture && r.mode === mode && r.cache === cache,
        );
        return {
          fixture,
          mode,
          cache,
          lcpMs: summary(selected.map((r) => r.lcpMs)),
          imageBytes: selected[0]!.imageBytes,
          resourceTransferBytes: summary(selected.map((r) => r.resourceTransferBytes)),
          maxCls: Math.max(...selected.map((r) => r.cls)),
        };
      }),
    ),
  );
  await save('browser-summary', summaries);
  return summaries;
}

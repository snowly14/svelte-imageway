import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const rows = [];
try {
  let expected: string | undefined;
  for (const scenario of ['Image', 'Picture', 'Both'])
    for (const variant of ['before', 'after']) {
      const root = resolve('.local/lean-3.2/client', scenario, variant, 'dist');
      const server = createServer((req, res) => {
        void (async () => {
          const pathname = new URL(req.url!, 'http://localhost').pathname;
          if (pathname === '/favicon.ico') {
            res.writeHead(204);
            res.end();
            return;
          }
          const file = resolve(
            root,
            '.' + (pathname === '/' ? '/index.html' : decodeURIComponent(pathname)),
          );
          if (!file.startsWith(root + '/')) {
            res.writeHead(403);
            res.end();
            return;
          }
          try {
            const bytes = await readFile(file);
            res.writeHead(200, {
              'Content-Type':
                (
                  {
                    '.html': 'text/html',
                    '.js': 'text/javascript',
                    '.css': 'text/css',
                    '.webp': 'image/webp',
                    '.png': 'image/png',
                  } as Record<string, string>
                )[extname(file)] ?? 'application/octet-stream',
            });
            res.end(bytes);
          } catch {
            res.writeHead(404);
            res.end();
          }
        })();
      });
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
      });
      try {
        const page = await context.newPage(),
          errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('console', (message) => {
          if (['warning', 'error'].includes(message.type())) errors.push(message.text());
        });
        page.on('response', (response) => {
          if (response.status() >= 400) errors.push(`HTTP ${response.status()} ${response.url()}`);
        });
        await page.goto(url);
        await page.waitForFunction(() =>
          Boolean(
            (globalThis as typeof globalThis & { __imagewayHydrated?: boolean }).__imagewayHydrated,
          ),
        );
        await page.locator('img').evaluateAll(async (images) => {
          await Promise.all(images.map((image) => (image as HTMLImageElement).decode()));
        });
        await page.waitForLoadState('networkidle');
        const images = await page.locator('img').count(),
          pictures = await page.locator('picture').count();
        assert.equal(images, scenario === 'Both' ? 2 : 1);
        assert.equal(pictures, scenario === 'Image' ? 0 : 1);
        const requests = await page.evaluate(
          () =>
            performance
              .getEntriesByType('resource')
              .filter(
                (entry) =>
                  (entry as PerformanceResourceTiming).initiatorType === 'img' ||
                  ((entry as PerformanceResourceTiming).initiatorType === 'link' &&
                    /\.webp$/.test(entry.name)),
              )
              .filter((entry) => /\.webp$/.test(entry.name)).length,
        );
        assert.equal(requests, 1);
        assert.deepEqual(errors, []);
        const selected = await page
          .locator('img')
          .first()
          .evaluate((image) => (image as HTMLImageElement).currentSrc);
        const response = await fetch(selected);
        assert.equal(response.status, 200);
        const sha256 = createHash('sha256')
          .update(Buffer.from(await response.arrayBuffer()))
          .digest('hex');
        expected ??= sha256;
        assert.equal(sha256, expected);
        const noJs = await browser.newContext({ javaScriptEnabled: false });
        try {
          const plain = await noJs.newPage();
          await plain.goto(url);
          assert.equal(await plain.locator('img').count(), images);
          assert.equal(
            await plain
              .locator('img')
              .evaluateAll((images) =>
                images.every((image) => (image as HTMLImageElement).naturalWidth > 0),
              ),
            true,
          );
        } finally {
          await noJs.close();
        }
        rows.push({
          scenario,
          variant,
          images,
          pictures,
          imageRequests: requests,
          imageSha256: sha256,
          hydrated: true,
          withoutJavaScript: true,
          errors,
        });
      } finally {
        await context.close();
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
      }
    }
} finally {
  await browser.close();
}
await writeFile(
  'bench/results/lean-preview-3.1.2/client-validation.json',
  JSON.stringify(
    {
      browser: browser.version(),
      protocol:
        'Six final SSR/client fixtures, strict hydration without recovery, one selected optimized image request, matching image bytes, no JS/console/HTTP errors, useful image loading with JavaScript disabled.',
      rows,
    },
    null,
    2,
  ) + '\n',
);
console.log('All six client fixtures passed.');

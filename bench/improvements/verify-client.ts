import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';

const browser = await chromium.launch();
const rows = [];
try {
  for (const scenario of ['Image', 'Picture'])
    for (const variant of ['before', 'after']) {
      const root = resolve('.local/perf-3.1/work', scenario, variant, 'dist');
      const server = createServer(async (req, res) => {
        try {
          const path = new URL(req.url!, 'http://localhost').pathname;
          if (path === '/favicon.ico') {
            res.writeHead(204);
            res.end();
            return;
          }
          const filename = resolve(root, path === '/' ? 'index.html' : '.' + path);
          if (!filename.startsWith(root + sep)) throw Error('Invalid path.');
          const type =
            (
              {
                '.html': 'text/html',
                '.js': 'text/javascript',
                '.css': 'text/css',
                '.png': 'image/png',
                '.webp': 'image/webp',
              } as Record<string, string>
            )[extname(filename)] ?? 'application/octet-stream';
          const bytes = await readFile(filename);
          res.writeHead(200, { 'Content-Type': type });
          res.end(bytes);
        } catch {
          res.writeHead(404);
          res.end();
        }
      });
      await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
      });
      try {
        const page = await context.newPage();
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('console', (message) => {
          if (['warning', 'error'].includes(message.type())) errors.push(message.text());
        });
        page.on('response', (response) => {
          if (response.status() >= 400) errors.push(`${response.status()}: ${response.url()}`);
        });
        await page.goto(`http://127.0.0.1:${(server.address() as { port: number }).port}/`, {
          waitUntil: 'networkidle',
        });
        await page.waitForFunction(
          () => (window as unknown as { __imagewayHydrated?: boolean }).__imagewayHydrated === true,
        );
        await page.waitForFunction(
          () =>
            document.querySelector('img')?.complete &&
            document.querySelector('img')!.naturalWidth > 0,
        );
        const metrics = await page.evaluate(() => ({
          pictures: document.querySelectorAll('picture').length,
          images: document.querySelectorAll('img').length,
          source: document.querySelector('img')!.currentSrc,
          width: document.querySelector('img')!.naturalWidth,
          imageRequests: performance
            .getEntriesByType('resource')
            .filter((r) => /\.(png|webp|jpe?g)$/.test(r.name)).length,
        }));
        if (
          errors.length ||
          metrics.images !== 1 ||
          metrics.imageRequests !== 1 ||
          metrics.pictures !== (scenario === 'Picture' ? 1 : 0) ||
          !metrics.source.endsWith('.webp')
        )
          throw Error(JSON.stringify({ scenario, variant, errors, metrics }));
        const response = await page.request.get(metrics.source);
        const imageSha256 = createHash('sha256')
          .update(await response.body())
          .digest('hex');
        rows.push({
          scenario,
          variant,
          ...metrics,
          source: new URL(metrics.source).pathname,
          imageSha256,
          hydrated: true,
          errors,
        });
      } finally {
        await context.close();
        await new Promise<void>((done) => server.close(() => done()));
      }
    }
} finally {
  await browser.close();
}
if (new Set(rows.map((r) => r.imageSha256)).size !== 1)
  throw Error('Client selected different image bytes.');
await writeFile(
  'bench/results/improvements-3.1/client-validation.json',
  JSON.stringify(
    {
      browser: browser.version(),
      protocol:
        'Untimed verification of all four final SSR/client fixtures; strict hydration recovery disabled, explicit post-hydrate marker, no console warnings/errors or failed responses; img/picture semantics, one image request and identical selected WebP bytes.',
      rows,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  'Four SSR/hydration fixtures passed with identical selected WebP, no warnings/errors and one image request.',
);

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, stat, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';
const root = process.cwd();
const evidence: Record<string, unknown> = {};
const children: ReturnType<typeof spawn>[] = [];
async function ready(url: string) {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* startup */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Server did not start: ${url}`);
}
const staticRoot = resolve('examples/static/build');
const staticServer = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const path = join(staticRoot, url.pathname === '/' ? 'index.html' : url.pathname);
  try {
    const info = await stat(path);
    if (!info.isFile()) throw new Error('not-file');
    response.setHeader(
      'Content-Type',
      path.endsWith('.html')
        ? 'text/html'
        : path.endsWith('.js')
          ? 'text/javascript'
          : path.endsWith('.css')
            ? 'text/css'
            : 'application/octet-stream',
    );
    response.end(await readFile(path));
  } catch {
    response.statusCode = 404;
    response.end();
  }
});
staticServer.listen(4273, '127.0.0.1');
const browser = await chromium.launch();
try {
  for (const [name, port] of [
    ['basic', 4271],
    ['node', 4272],
  ] as const) {
    const child = spawn('node', ['build/index.js'], {
      cwd: join(root, 'examples', name),
      env: {
        ...process.env,
        PORT: String(port),
        HOST: '127.0.0.1',
        ORIGIN: `http://127.0.0.1:${port}`,
      },
      stdio: 'pipe',
    });
    let logs = '';
    child.stdout?.on('data', (b) => (logs += b.toString()));
    child.stderr?.on('data', (b) => (logs += b.toString()));
    children.push(child);
    await ready(`http://127.0.0.1:${port}`);
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${port}`);
    await page.waitForFunction(() => {
      const img = document.querySelector('img');
      return img?.complete && img.naturalWidth > 0;
    });
    const image = await page.locator('img').evaluate((img: HTMLImageElement) => ({
      src: img.currentSrc,
      width: img.naturalWidth,
      loading: img.loading,
      priority: img.fetchPriority,
    }));
    const response = await fetch(image.src, { headers: { Accept: 'image/webp' } });
    if (response.status !== 200 || errors.length)
      throw new Error(`${name} smoke failed: ${response.status}; ${errors}; ${logs}`);
    evidence[name] = {
      status: response.status,
      contentType: response.headers.get('content-type'),
      image,
      browserErrors: errors,
    };
    if (name === 'node') {
      const second = await fetch(image.src, {
        headers: { Accept: 'image/webp', 'If-None-Match': response.headers.get('etag')! },
      });
      if (second.status !== 304) throw new Error('Node runtime conditional request failed.');
    }
    await page.close();
  }
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:4273');
  await page.waitForFunction(() => {
    const img = document.querySelector('img');
    return img?.complete && img.naturalWidth > 0;
  });
  evidence.static = { status: 200, imageRendered: true };
  await page.close();
  for (const name of ['basic', 'static', 'node']) {
    async function inspect(directory: string): Promise<void> {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) await inspect(path);
        else if (
          entry.name.endsWith('.js') &&
          /[\x22\x27\x60]node:|worker_threads|sharp\/lib|IMAGEWAY_TEST_KEY/.test(
            await readFile(path, 'utf8'),
          )
        )
          throw new Error(`Server leak: ${path}`);
      }
    }
    await inspect(join(root, 'examples', name, '.svelte-kit/output/client'));
  }
  await writeFile('.local/m4-smoke.json', JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  await browser.close();
  staticServer.close();
  for (const child of children) child.kill('SIGTERM');
}

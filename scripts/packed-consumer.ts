import { mkdir, rm, writeFile, copyFile, readFile, realpath } from 'node:fs/promises';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve, join } from 'node:path';
import { chromium } from '@playwright/test';
import sharp from 'sharp';
const exec = promisify(execFile);
const root = resolve('.local/packed-consumer');
const version: string = JSON.parse(
  await readFile('packages/svelte-imageway/package.json', 'utf8'),
).version;
const archive = resolve(`.local/pack/svelte-imageway-${version}.tgz`);
const started = performance.now();
await rm(root, { recursive: true, force: true });
await mkdir(join(root, 'src/routes'), { recursive: true });
await writeFile(
  join(root, 'package.json'),
  JSON.stringify(
    {
      name: 'imageway-packed-consumer',
      private: true,
      type: 'module',
      scripts: { build: 'vite build', check: 'svelte-check --tsconfig ./tsconfig.json' },
      dependencies: { 'svelte-imageway': archive, svelte: '5.57.2', '@sveltejs/kit': '3.1.0' },
      devDependencies: {
        vite: '8.3.4',
        '@sveltejs/vite-plugin-svelte': '7.3.1',
        '@sveltejs/adapter-static': '4.0.0',
        typescript: '6.0.3',
        'svelte-check': '4.7.7',
      },
    },
    null,
    2,
  ),
);
await writeFile(
  join(root, 'vite.config.ts'),
  "import { defineConfig } from 'vite';\nimport { sveltekit } from '@sveltejs/kit/vite';\nimport adapter from '@sveltejs/adapter-static';\nexport default defineConfig({plugins:[sveltekit({adapter:adapter()})]});\n",
);
await writeFile(
  join(root, 'tsconfig.json'),
  JSON.stringify({
    extends: '$app/tsconfig',
    include: ['src', 'test', '*'],
    exclude: ['src/service-worker'],
    compilerOptions: { strict: true },
  }),
);
await copyFile('examples/basic/src/app.html', join(root, 'src/app.html'));
await copyFile('examples/basic/src/routes/landscape.png', join(root, 'src/routes/hero.png')).catch(
  () => copyFile('examples/components/src/landscape.png', join(root, 'src/routes/hero.png')),
);
await writeFile(join(root, 'src/routes/+layout.ts'), 'export const prerender = true;\n');
async function run(command: string, args: string[]) {
  const value = await exec(command, args, { cwd: root, maxBuffer: 4_000_000 });
  process.stdout.write(value.stdout);
  process.stderr.write(value.stderr);
}
await run('bun', ['install']);
const installed = await realpath(join(root, 'node_modules/svelte-imageway/package.json'));
if (installed === resolve('packages/svelte-imageway/package.json'))
  throw new Error('Consumer unexpectedly linked the workspace.');
await run('node', ['node_modules/svelte-imageway/dist/cli/index.js', 'init', root]);
await writeFile(
  join(root, 'src/routes/+page.svelte'),
  '<script lang="ts">import { Image } from "svelte-imageway"; import hero from "./hero.png"; const original: string = hero;</script>\n<Image src={hero} alt="Original synthetic landscape" priority sizes="640px" />\n<img data-testid="original" src={original} alt="Original file" width="64" />\n',
);
await run('bun', ['run', 'build']);
await run('bun', ['run', 'check']);
for (const name of ['src/imageway-env.d.ts', 'src/imageway.d.ts', 'imageway-env.d.ts']) {
  if (
    await readFile(join(root, name), 'utf8').then(
      () => true,
      () => false,
    )
  )
    throw new Error('Consumer unexpectedly relies on a generated type file: ' + name);
}
const readyMs = performance.now() - started;
const server = spawn(
  'node',
  [
    'node_modules/vite/bin/vite.js',
    'preview',
    '--host',
    '127.0.0.1',
    '--port',
    '4191',
    '--strictPort',
  ],
  { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
);
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch('http://127.0.0.1:4191')).ok) break;
    } catch {
      /* Wait for the owned preview process. */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:4191');
    const image = page.getByAltText('Original synthetic landscape');
    if (await image.evaluate((img) => img.parentElement?.tagName === 'PICTURE'))
      throw new Error('Image unexpectedly rendered picture.');
    await image.evaluate((img: HTMLImageElement) => img.decode());
    const dimensions = await image.evaluate((img: HTMLImageElement) => ({
      width: img.naturalWidth,
      height: img.naturalHeight,
    }));
    if (!dimensions.width || (await page.locator('link[rel="preload"][as="image"]').count()) !== 1)
      throw new Error('Packed image/preload failed.');
    const response = await fetch(await image.evaluate((img: HTMLImageElement) => img.currentSrc));
    const encoded = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
    const originalUrl = await page.getByTestId('original').getAttribute('src');
    const originalResponse = await fetch(new URL(originalUrl!, 'http://127.0.0.1:4191'));
    if (
      !Buffer.from(await originalResponse.arrayBuffer()).equals(
        await readFile(join(root, 'src/routes/hero.png')),
      )
    )
      throw new Error('Ordinary import no longer preserves original bytes.');
    const requests = await page.evaluate(
      () =>
        performance
          .getEntriesByType('resource')
          .filter((entry) => entry.name.includes('/imageway/') && !entry.name.endsWith('.png'))
          .length,
    );
    if (requests !== 1)
      throw new Error('Priority image was downloaded more than once: ' + requests);
    const noJs = await browser.newContext({ javaScriptEnabled: false });
    try {
      const ssrPage = await noJs.newPage();
      await ssrPage.goto('http://127.0.0.1:4191');
      const ssrImage = ssrPage.getByAltText('Original synthetic landscape');
      if (
        !(await ssrImage.getAttribute('srcset'))?.includes('640w') ||
        !(await ssrImage.getAttribute('width'))
      )
        throw new Error('Ordinary import SSR metadata is missing without JavaScript.');
    } finally {
      await noJs.close();
    }

    if (encoded.width !== 640 || encoded.format !== 'webp')
      throw new Error('Packed import did not serve the optimized variant.');
    const report = {
      measuredAt: new Date().toISOString(),
      archive,
      packageVersion: JSON.parse(await readFile(installed, 'utf8')).version,
      node: (await exec('node', ['--version'])).stdout.trim(),
      installAndBuildAndTypesMs: readyMs,
      underTwoMinutes: readyMs < 120000,
      cacheNote: 'Local Bun registry/cache already warm; no network-cold timing claim.',
      dimensions,
      dimensionNote:
        'Browser naturalWidth is density-corrected by srcset/sizes; encoded dimensions are verified separately.',
      encoded: { width: encoded.width, height: encoded.height, format: encoded.format },
      preload: true,
    };
    await writeFile('.local/packed-consumer.json', JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
  } finally {
    await browser.close();
  }
} finally {
  server.kill('SIGTERM');
}

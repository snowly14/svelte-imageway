import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { build } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import type { imageway as Factory } from '../../packages/svelte-imageway/dist/vite/index.js';
import type { placeholder as Preview } from '../../packages/svelte-imageway/dist/vite/placeholder.js';
import { createHistogramControl } from './histogram.ts';
import sharp from 'sharp';

const [mode, packageRoot, root, strategy] = process.argv.slice(2) as [
  string,
  string,
  string,
  Parameters<typeof Preview>[1],
];
const sha = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
let report: Record<string, unknown>;
if (mode === 'histogram') {
  const inputs = await Promise.all(
    Array.from({ length: 24 }, (_, i) =>
      sharp(resolve('.local/photographic/corpus', `kodim${String(i + 1).padStart(2, '0')}.png`))
        .autoOrient()
        .resize({ width: 32, height: 32, fit: 'inside', withoutEnlargement: true })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true }),
    ),
  );
  const started = performance.now();
  const dominant =
    (strategy as string) === 'js'
      ? createHistogramControl()
      : (
          await (
            (await import(
              pathToFileURL(join(packageRoot, 'dist/node/blurhash.js')).href
            )) as typeof import('../../packages/svelte-imageway/dist/node/blurhash.js')
          ).getBlurhashEncoder()
        ).dominantColor;
  const initializationMs = performance.now() - started;
  const batch = () => inputs.map(({ data, info }) => dominant(data, info.width, info.height));
  const firstStart = performance.now();
  const first = batch();
  const firstBatchMs = performance.now() - firstStart;
  for (let i = 0; i < 25; i++) batch();
  const begin = performance.now();
  let checksum = 0;
  for (let i = 0; i < 500; i++) checksum += batch().filter(Boolean).length;
  report = {
    initializationMs,
    firstBatchMs,
    perPhotoMs: (performance.now() - begin) / 12000,
    checksum,
    outputDigest: sha(JSON.stringify(first)),
    strategy,
    ambiguous: first.filter((value) => !value).length,
  };
} else if (mode === 'preview') {
  const sourceRoot = resolve('.local/photographic/corpus');
  const sources = await Promise.all(
    Array.from({ length: 24 }, (_, i) =>
      readFile(join(sourceRoot, `kodim${String(i + 1).padStart(2, '0')}.png`)),
    ),
  );
  const started = performance.now();
  const { placeholder } = (await import(
    pathToFileURL(join(packageRoot, 'dist/vite/placeholder.js')).href
  )) as { placeholder: typeof Preview };
  const initializationMs = performance.now() - started;
  async function batch() {
    const outputs = [];
    for (const bytes of sources) outputs.push(await placeholder(bytes, strategy));
    return JSON.stringify(outputs);
  }
  const firstStart = performance.now();
  const first = await batch();
  const firstBatchMs = performance.now() - firstStart;
  await batch();
  const begin = performance.now();
  let checksum = 0;
  for (let i = 0; i < 3; i++) checksum += (await batch()).length;
  report = {
    initializationMs,
    firstBatchMs,
    perPhotoMs: (performance.now() - begin) / 72,
    checksum,
    outputDigest: sha(first),
    strategy,
  };
} else {
  const started = performance.now();
  const { imageway } = (await import(
    pathToFileURL(join(packageRoot, 'dist/vite/index.js')).href
  )) as { imageway: typeof Factory };
  const aliases = [
    { find: /^svelte-imageway$/, replacement: join(packageRoot, 'dist/index.js') },
    { find: /^svelte-imageway\/core$/, replacement: join(packageRoot, 'dist/core/index.js') },
  ];
  const options =
    mode === 'client'
      ? {
          config: {
            widths: [288, 384, 480],
            formats: ['webp'] as const,
            placeholder: 'none' as const,
          },
        }
      : {};
  await build({
    root,
    configFile: false,
    logLevel: 'silent',
    resolve: { alias: aliases },
    plugins: [imageway(options), svelte()],
    build: { outDir: 'dist', minify: true, assetsInlineLimit: 0 },
  });
  const buildMs = performance.now() - started;
  if (mode === 'client') {
    await build({
      root,
      configFile: false,
      logLevel: 'silent',
      resolve: { alias: aliases },
      plugins: [imageway(options), svelte()],
      ssr: { noExternal: ['svelte-imageway'] },
      build: { outDir: 'ssr', ssr: 'ssr.js', assetsInlineLimit: 0 },
    });
    const { page } = (await import(pathToFileURL(join(root, 'ssr/ssr.js')).href)) as {
      page: () => { body: string; head: string };
    };
    const rendered = page();
    const html = (await readFile(join(root, 'dist/index.html'), 'utf8'))
      .replace('<div id="app"></div>', `<div id="app">${rendered.body}</div>`)
      .replace('</head>', `${rendered.head}</head>`);
    const { writeFile } = await import('node:fs/promises');
    await writeFile(join(root, 'dist/index.html'), html);
  }
  const assets: Array<{ bytes: number; sha256: string }> = [];
  let jsGzipBytes = 0;
  let jsText = '';
  async function walk(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = join(directory, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (/\.(avif|webp|jpe?g|png)$/.test(file)) {
        const bytes = await readFile(file);
        assets.push({ bytes: bytes.length, sha256: sha(bytes) });
      } else if (file.endsWith('.js')) {
        const bytes = await readFile(file);
        jsGzipBytes += gzipSync(bytes, { level: 9 }).length;
        jsText += bytes.toString();
      }
    }
  }
  await walk(join(root, 'dist'));
  if (mode === 'client' && /maxInputBytes|presets:|WebAssembly|blurhash\.wasm/.test(jsText)) {
    // Retain a diagnostic for the old entry as well as the candidate.
    report = {
      buildMs,
      jsGzipBytes,
      serverDefaultsPresent: /maxInputBytes|presets:/.test(jsText),
      wasmPresent: /WebAssembly|blurhash\.wasm/.test(jsText),
    };
  } else report = { buildMs, jsGzipBytes, serverDefaultsPresent: false, wasmPresent: false };
  report.assets = assets.toSorted((a, b) => a.sha256.localeCompare(b.sha256));
}
console.log(
  JSON.stringify({
    ...report,
    peakRssBytes: process.resourceUsage().maxRSS * 1024,
    node: process.version,
  }),
);

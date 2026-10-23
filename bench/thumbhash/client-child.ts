import { build } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const [packageRoot, root] = process.argv.slice(2) as [string, string];
const { imageway } = (await import(
  pathToFileURL(join(packageRoot, 'dist/vite/index.js')).href
)) as typeof import('../../packages/svelte-imageway/dist/vite/index.js');
const alias = [
  { find: /^svelte-imageway$/, replacement: join(packageRoot, 'dist/index.js') },
  { find: /^svelte-imageway\/core$/, replacement: join(packageRoot, 'dist/core/index.js') },
];
const options = {
  config: { widths: [288, 384, 480], formats: ['webp'] as const, placeholder: 'none' as const },
};
await build({
  root,
  configFile: false,
  logLevel: 'silent',
  resolve: { alias },
  plugins: [imageway(options), svelte()],
  build: { outDir: 'dist', assetsInlineLimit: 0, minify: true },
});
await build({
  root,
  configFile: false,
  logLevel: 'silent',
  resolve: { alias },
  plugins: [imageway(options), svelte()],
  ssr: { noExternal: ['svelte-imageway'] },
  build: { outDir: 'ssr', ssr: 'ssr.js', assetsInlineLimit: 0 },
});
const { page } = (await import(pathToFileURL(join(root, 'ssr/ssr.js')).href)) as {
  page: () => { body: string; head: string };
};
const rendered = page();
await writeFile(
  join(root, 'dist/index.html'),
  (await readFile(join(root, 'dist/index.html'), 'utf8'))
    .replace('<div id="app"></div>', `<div id="app">${rendered.body}</div>`)
    .replace('</head>', `${rendered.head}</head>`),
);
const assets: Array<{ bytes: number; sha256: string }> = [];
let jsGzipBytes = 0,
  cssGzipBytes = 0,
  jsBytes = 0,
  cssBytes = 0,
  text = '';
async function walk(directory: string) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) await walk(file);
    else {
      const bytes = await readFile(file);
      if (/\.(webp|png|jpeg|avif)$/.test(file))
        assets.push({
          bytes: bytes.length,
          sha256: createHash('sha256').update(bytes).digest('hex'),
        });
      if (file.endsWith('.js')) {
        jsBytes += bytes.length;
        jsGzipBytes += gzipSync(bytes, { level: 9 }).length;
        text += bytes.toString();
      }
      if (file.endsWith('.css')) {
        cssBytes += bytes.length;
        cssGzipBytes += gzipSync(bytes, { level: 9 }).length;
      }
    }
  }
}
await walk(join(root, 'dist'));
if (/WebAssembly|blurhash\.wasm|worker_threads|node:fs/.test(text))
  throw Error('Server code entered client bundle.');
console.log(
  JSON.stringify({
    jsBytes,
    cssBytes,
    jsGzipBytes,
    cssGzipBytes,
    totalGzipBytes: jsGzipBytes + cssGzipBytes,
    assets: assets.toSorted((a, b) => a.sha256.localeCompare(b.sha256)),
    peakRssBytes: process.resourceUsage().maxRSS * 1024,
  }),
);

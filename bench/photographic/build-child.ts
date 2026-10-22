import { build } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { digest } from './common.ts';

const [engine, root] = process.argv.slice(2) as [string, string];
const started = performance.now();
const plugins = engine.startsWith('imageway')
  ? [(await import('../../packages/svelte-imageway/dist/vite/index.js')).imageway()]
  : engine === 'imagetools'
    ? [
        (await import('vite-imagetools')).imagetools({
          cache: { dir: join(root, 'node_modules/.cache/imagetools') },
        }),
      ]
    : await (await import('@sveltejs/enhanced-img')).enhancedImages();
await build({
  root,
  configFile: false,
  logLevel: 'silent',
  resolve: {
    alias: [
      {
        find: /^svelte-imageway\/core$/,
        replacement: fileURLToPath(
          new URL('../../packages/svelte-imageway/dist/core/index.js', import.meta.url),
        ),
      },
    ],
  },
  plugins: [...plugins, svelte()],
  build: { outDir: 'dist', minify: true, assetsInlineLimit: 0 },
});
const buildMs = performance.now() - started;
const assets: Array<{ file: string; bytes: number; sha256: string }> = [];
async function walk(directory: string) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) await walk(file);
    else if (/\.(webp|jpe?g|png|avif)$/.test(file))
      assets.push({
        file: file.slice(root.length + 6),
        bytes: (await stat(file)).size,
        sha256: digest(await readFile(file)),
      });
  }
}
await walk(join(root, 'dist'));
console.log(
  JSON.stringify({
    engine,
    buildMs,
    peakRssBytes: process.resourceUsage().maxRSS * 1024,
    assets: assets.toSorted((a, b) => a.sha256.localeCompare(b.sha256)),
    node: process.version,
  }),
);

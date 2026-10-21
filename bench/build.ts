import { build } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { join } from 'node:path';
import { readdir, stat } from 'node:fs/promises';
import { imageway } from '../packages/svelte-imageway/dist/vite/index.js';
import { pathToFileURL } from 'node:url';
import { imagetools } from 'vite-imagetools';
import { enhancedImages } from '@sveltejs/enhanced-img';
const [engine, root] = process.argv.slice(2) as [string, string];
const imagewayFactory: typeof imageway = process.env.IMAGEWAY_BENCH_PLUGIN
  ? (await import(pathToFileURL(process.env.IMAGEWAY_BENCH_PLUGIN).href)).imageway
  : imageway;
const started = performance.now();
await build({
  root,
  configFile: false,
  logLevel: 'silent',
  plugins: [
    ...(engine === 'imageway'
      ? [imagewayFactory()]
      : engine === 'imagetools'
        ? [imagetools({ cache: { dir: join(root, 'node_modules/.cache/imagetools') } })]
        : await enhancedImages()),
    svelte(),
  ],
  build: { outDir: 'dist', minify: true },
});
let imageBytes = 0,
  imageFiles = 0;
async function walk(path: string) {
  for (const e of await readdir(path, { withFileTypes: true })) {
    const file = join(path, e.name);
    if (e.isDirectory()) await walk(file);
    else if (/\.(webp|jpe?g|png|avif)$/.test(e.name)) {
      imageFiles++;
      imageBytes += (await stat(file)).size;
    }
  }
}
await walk(join(root, 'dist'));
console.log(
  JSON.stringify({
    engine,
    durationMs: performance.now() - started,
    imageBytes,
    imageFiles,
    rssPeakBytes: process.resourceUsage().maxRSS * 1024,
    node: process.version,
    sharp: (await import('sharp')).default.versions,
  }),
);

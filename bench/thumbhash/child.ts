import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { rgbaToThumbHash } from 'thumbhash';
import { createThumbHashControl } from './control.ts';

const [mode, packageRoot, strategy] = process.argv.slice(2) as [
  string,
  string,
  'thumbhash' | 'lqip',
];
const sources = await Promise.all(
  Array.from({ length: 24 }, (_, i) =>
    readFile(resolve('.local/photographic/corpus', `kodim${String(i + 1).padStart(2, '0')}.png`)),
  ),
);
const sha = (value: string) => createHash('sha256').update(value).digest('hex');
let result;
if (mode === 'preview') {
  const start = performance.now();
  const { placeholder } = (await import(
    pathToFileURL(join(packageRoot, 'dist/vite/placeholder.js')).href
  )) as typeof import('../../packages/svelte-imageway/dist/vite/placeholder.js');
  const initializationMs = performance.now() - start;
  async function batch() {
    const out = [];
    for (const source of sources) out.push(await placeholder(source, strategy));
    return JSON.stringify(out);
  }
  const firstStart = performance.now(),
    first = await batch(),
    firstBatchMs = performance.now() - firstStart;
  await batch();
  const started = performance.now();
  let checksum = 0;
  for (let i = 0; i < 3; i++) checksum += (await batch()).length;
  result = {
    initializationMs,
    firstBatchMs,
    perOperationMs: (performance.now() - started) / 72,
    digest: sha(first),
    checksum,
  };
} else {
  const inputs = await Promise.all(
    sources.map((source) =>
      sharp(source)
        .autoOrient()
        .resize({ width: 32, height: 32, fit: 'inside', withoutEnlargement: true })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true }),
    ),
  );
  const started = performance.now();
  const encode =
    mode === 'referenceJS'
      ? (pixels: Uint8Array, width: number, height: number) =>
          rgbaToThumbHash(width, height, pixels)
      : mode === 'cachedJS'
        ? createThumbHashControl()
        : (
            await (
              (await import(
                pathToFileURL(join(packageRoot, 'dist/node/blurhash.js')).href
              )) as typeof import('../../packages/svelte-imageway/dist/node/blurhash.js')
            ).getBlurhashEncoder()
          ).thumbHash;
  const initializationMs = performance.now() - started;
  const batch = () => inputs.map(({ data, info }) => encode(data, info.width, info.height));
  const firstStart = performance.now(),
    first = batch(),
    firstBatchMs = performance.now() - firstStart;
  for (let i = 0; i < 25; i++) batch();
  const begin = performance.now();
  let checksum = 0;
  for (let i = 0; i < 500; i++) for (const hash of batch()) checksum += hash[0]! + hash.length;
  result = {
    initializationMs,
    firstBatchMs,
    perOperationMs: (performance.now() - begin) / 12000,
    digest: sha(JSON.stringify(first.map((hash) => Buffer.from(hash).toString('base64')))),
    checksum,
  };
}
console.log(
  JSON.stringify({
    ...result,
    peakRssBytes: process.resourceUsage().maxRSS * 1024,
    node: process.version,
  }),
);

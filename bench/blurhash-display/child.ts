import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { digest, names, corpus } from '../photographic/common.ts';
import { createBlurhashDecodeControl } from './control.ts';
const [mode, root, strategy = 'blurhash'] = process.argv.slice(2) as [
  string,
  string,
  'blurhash' | 'thumbhash' | 'lqip',
];
const sources = await Promise.all(names.map((name) => readFile(join(corpus, name))));
if (mode === 'preview') {
  const initialized = performance.now();
  const { placeholder } = (await import(
    pathToFileURL(join(root, 'dist/vite/placeholder.js')).href
  )) as typeof import('../../packages/svelte-imageway/dist/vite/placeholder.js');
  const initializationMs = performance.now() - initialized;
  const batch = async () => {
    const out = [];
    for (const source of sources) out.push(await placeholder(source, strategy));
    return JSON.stringify(out);
  };
  const started = performance.now(),
    first = await batch(),
    firstBatchMs = performance.now() - started;
  await batch();
  const timed = performance.now();
  let checksum = 0;
  for (let i = 0; i < 3; i++) checksum += (await batch()).length;
  console.log(
    JSON.stringify({
      initializationMs,
      firstBatchMs,
      perOperationMs: (performance.now() - timed) / 72,
      checksum,
      digest: digest(first),
      peakRssBytes: process.resourceUsage().maxRSS * 1024,
      node: process.version,
    }),
  );
} else {
  const { encode, decode } = await import('blurhash');
  const hashes: string[] = [];
  for (const source of sources) {
    const { data, info } = await sharp(source)
      .autoOrient()
      .resize({ width: 32, height: 32, fit: 'inside', withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    hashes.push(encode(new Uint8ClampedArray(data), info.width, info.height, 4, 3));
  }
  const initialized = performance.now();
  const run =
    mode === 'referenceJS'
      ? (hash: string) => decode(hash, 16, 16)
      : mode === 'cachedJS'
        ? createBlurhashDecodeControl()
        : mode === 'thresholdJS'
          ? createBlurhashDecodeControl(true)
          : (
              await (
                (await import(
                  pathToFileURL(join(root, 'dist/node/blurhash.js')).href
                )) as typeof import('../../packages/svelte-imageway/dist/node/blurhash.js')
              ).getBlurhashEncoder()
            ).decodeBlurHash;
  const initializationMs = performance.now() - initialized;
  const batch = () => hashes.map((hash) => run(hash));
  const started = performance.now(),
    first = batch(),
    firstBatchMs = performance.now() - started;
  for (let i = 0; i < 25; i++) batch();
  const timed = performance.now();
  let checksum = 0;
  for (let i = 0; i < 500; i++) for (const value of batch()) checksum += value[100]! + value.length;
  console.log(
    JSON.stringify({
      initializationMs,
      firstBatchMs,
      perOperationMs: (performance.now() - timed) / 12000,
      checksum,
      digest: digest(first.map((value) => Buffer.from(value).toString('base64')).join('\n')),
      peakRssBytes: process.resourceUsage().maxRSS * 1024,
      node: process.version,
    }),
  );
}

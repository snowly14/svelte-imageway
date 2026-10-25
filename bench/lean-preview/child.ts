import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { rgbaToThumbHash, thumbHashToRGBA, thumbHashToDataURL } from 'thumbhash';
import { createDecodeControl, createPNGControl } from './control.ts';
const [mode, root, strategy = 'thumbhash'] = process.argv.slice(2) as [
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
const initialize = performance.now();
let initializationMs: number;
if (mode === 'props') {
  const { getImageProps } = (await import(
    pathToFileURL(join(root, 'dist/props.js')).href
  )) as typeof import('../../packages/svelte-imageway/dist/props.js');
  const { registerImageArtifact } = (await import(
    pathToFileURL(join(root, 'dist/core/artifact.js')).href
  )) as typeof import('../../packages/svelte-imageway/dist/core/artifact.js');
  const inputs = Array.from({ length: 24 }, (_, index) => {
    const src = `/_app/assets/original-${index}.jpg`;
    registerImageArtifact(src, {
      src: `/_imageway/${index}.jpeg`,
      srcset: `/_imageway/${index}-small.jpeg 320w, /_imageway/${index}.jpeg 640w`,
      width: 640,
      height: 400,
      aspectRatio: 1.6,
      sources: [],
      dominantColor: '#103050',
    });
    return {
      src,
      alt: `Photo ${index}`,
      config: { providers: {} },
      formatStrategy: 'img' as const,
    };
  });
  initializationMs = performance.now() - initialize;
  const batch = () => inputs.map((input) => getImageProps(input));
  const started = performance.now(),
    first = batch(),
    firstBatchMs = performance.now() - started;
  for (let i = 0; i < 100; i++) batch();
  const timed = performance.now();
  let checksum = 0;
  for (let i = 0; i < 10000; i++) for (const value of batch()) checksum += String(value.src).length;
  const perOperationMs = (performance.now() - timed) / 240000;
  const canonical = first.map((value) =>
    Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))),
  );
  console.log(
    JSON.stringify({
      initializationMs,
      firstBatchMs,
      perOperationMs,
      checksum,
      digest: sha(JSON.stringify(canonical)),
      peakRssBytes: process.resourceUsage().maxRSS * 1024,
      node: process.version,
    }),
  );
} else if (mode === 'preview') {
  const { placeholder } = (await import(
    pathToFileURL(join(root, 'dist/vite/placeholder.js')).href
  )) as typeof import('../../packages/svelte-imageway/dist/vite/placeholder.js');
  initializationMs = performance.now() - initialize;
  const batch = async () =>
    JSON.stringify(
      await sources.reduce(
        async (previous, source) => [...(await previous), await placeholder(source, strategy)],
        Promise.resolve([] as Awaited<ReturnType<typeof placeholder>>[]),
      ),
    );
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
      digest: sha(first),
      peakRssBytes: process.resourceUsage().maxRSS * 1024,
      node: process.version,
    }),
  );
} else {
  const hashes = await Promise.all(
    sources.map(async (source) => {
      const { data, info } = await sharp(source)
        .autoOrient()
        .resize({ width: 32, height: 32, fit: 'inside', withoutEnlargement: true })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      return rgbaToThumbHash(info.width, info.height, data);
    }),
  );
  const begin = performance.now();
  const kernel =
    mode === 'rust' || mode === 'rustPNG'
      ? await (
          (await import(
            pathToFileURL(join(root, 'dist/node/blurhash.js')).href
          )) as typeof import('../../packages/svelte-imageway/dist/node/blurhash.js')
        ).getBlurhashEncoder()
      : undefined;
  const cached = createDecodeControl();
  const cachedPNG = createPNGControl();
  initializationMs = performance.now() - begin;
  const decode =
    mode === 'referenceJS'
      ? thumbHashToRGBA
      : mode === 'cachedJS'
        ? cached
        : kernel?.decodeThumbHash;
  const png =
    mode === 'referencePNG'
      ? thumbHashToDataURL
      : mode === 'cachedPNG'
        ? (hash: Uint8Array) => {
            const img = cached(hash);
            return cachedPNG(img.w, img.h, img.rgba);
          }
        : kernel?.thumbHashDataURL;
  const full = mode.endsWith('PNG');
  const batch = () =>
    hashes.map((hash) => (full ? png!(hash) : Buffer.from(decode!(hash).rgba).toString('base64')));
  const firstStart = performance.now(),
    first = batch(),
    firstBatchMs = performance.now() - firstStart;
  for (let i = 0; i < 25; i++) batch();
  const timed = performance.now();
  let checksum = 0;
  for (let i = 0; i < 200; i++)
    for (const output of batch()) checksum += output.length + output.charCodeAt(40);
  console.log(
    JSON.stringify({
      initializationMs,
      firstBatchMs,
      perOperationMs: (performance.now() - timed) / 4800,
      checksum,
      digest: sha(JSON.stringify(first)),
      peakRssBytes: process.resourceUsage().maxRSS * 1024,
      node: process.version,
    }),
  );
}

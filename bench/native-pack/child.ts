import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp, { type OutputInfo } from 'sharp';
import { digest, names, corpus } from '../photographic/common.ts';
const [root, mode, strategy = 'blurhash'] = process.argv.slice(2) as [
  string,
  string,
  'blurhash' | 'lqip',
];
const sources = await Promise.all(names.map((name) => readFile(join(corpus, name))));
if (mode === 'encode') {
  const inputs: Array<{ data: Buffer; info: OutputInfo }> = [];
  for (const source of sources)
    inputs.push(
      await sharp(source)
        .autoOrient()
        .resize({ width: 32, height: 32, fit: 'inside', withoutEnlargement: true })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true }),
    );
  const start = performance.now();
  const { getBlurhashEncoder } = (await import(
    pathToFileURL(join(root, 'dist/node/blurhash.js')).href
  )) as typeof import('../../packages/svelte-imageway/dist/node/blurhash.js');
  const encoder = await getBlurhashEncoder(),
    initializationMs = performance.now() - start;
  const batch = () => inputs.map(({ data, info }) => encoder.encode(data, info.width, info.height));
  const firstStart = performance.now(),
    first = batch(),
    firstBatchMs = performance.now() - firstStart;
  for (let i = 0; i < 25; i++) batch();
  let checksum = 0;
  const cpu = process.cpuUsage(),
    timed = performance.now();
  for (let i = 0; i < 500; i++) for (const hash of batch()) checksum += hash.charCodeAt(15);
  const elapsedMs = performance.now() - timed,
    usage = process.cpuUsage(cpu);
  console.log(
    JSON.stringify({
      perOperationMs: elapsedMs / 12000,
      cpuMicrosecondsPerOperation: (usage.user + usage.system) / 12000,
      initializationMs,
      firstBatchMs,
      digest: digest(JSON.stringify(first)),
      checksum,
      peakRssBytes: process.resourceUsage().maxRSS * 1024,
      node: process.version,
    }),
  );
} else {
  const start = performance.now();
  const { placeholder } = (await import(
    pathToFileURL(join(root, 'dist/vite/placeholder.js')).href
  )) as typeof import('../../packages/svelte-imageway/dist/vite/placeholder.js');
  const initializationMs = performance.now() - start;
  const batch = async () => {
    const out = [];
    for (const source of sources) out.push(await placeholder(source, strategy));
    return JSON.stringify(out);
  };
  const firstStart = performance.now(),
    first = await batch(),
    firstBatchMs = performance.now() - firstStart;
  await batch();
  let checksum = 0;
  const startTimed = performance.now();
  for (let i = 0; i < 3; i++) checksum += (await batch()).length;
  console.log(
    JSON.stringify({
      perOperationMs: (performance.now() - startTimed) / 72,
      initializationMs,
      firstBatchMs,
      digest: digest(first),
      checksum,
      peakRssBytes: process.resourceUsage().maxRSS * 1024,
      node: process.version,
    }),
  );
}

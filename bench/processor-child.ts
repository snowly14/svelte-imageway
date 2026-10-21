import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import type { ImageProcessor as Processor } from '../packages/svelte-imageway/dist/node/processor.js';
const [modulePath, file, format, iterationsText, directory] = process.argv.slice(2) as [
  string,
  string,
  'webp' | 'png',
  string,
  string,
];
const { ImageProcessor }: { ImageProcessor: typeof Processor } = await import(
  pathToFileURL(resolve(modulePath)).href
);
const processor = new ImageProcessor({ directory });
const source = processor.prepare(await readFile(file));
const request = { key: 'bench', w: 960, q: 75 };
const first = await source.process(request, format, undefined, false);
const outputDigest = createHash('sha256').update(first.data).digest('hex');
for (let i = 0; i < 20; i++) await source.process(request, format, undefined, false);
const iterations = Number(iterationsText);
let checksum = 0;
const start = performance.now();
for (let i = 0; i < iterations; i++) {
  const value = await source.process(request, format, undefined, false);
  if (!value.cacheHit) throw new Error('Expected memory cache hit');
  checksum += value.data.length + value.data[0]!;
}
const elapsedMs = performance.now() - start;
console.log(
  JSON.stringify({
    iterations,
    elapsedMs,
    operationsPerSecond: (iterations * 1000) / elapsedMs,
    checksum,
    outputDigest,
    outputBytes: first.data.length,
    peakRssBytes: process.resourceUsage().maxRSS * 1024,
    node: process.version,
  }),
);

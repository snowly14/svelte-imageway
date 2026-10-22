import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { decode } from 'blurhash';
import { optimizedJS } from '../preview-js.ts';
import { corpus, names, digest } from './common.ts';

const mode = process.argv[2]!;
const sources = await Promise.all(names.map((name) => readFile(join(corpus, name))));
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
const begin = performance.now();
const encode = mode.endsWith('rust')
  ? (
      await (
        await import('../../packages/svelte-imageway/dist/node/blurhash.js')
      ).getBlurhashEncoder()
    ).encode
  : optimizedJS();
const initializationMs = performance.now() - begin;
const pipeline = mode.startsWith('pipeline');
async function preview(source: Buffer) {
  const { data, info } = await sharp(source)
    .autoOrient()
    .resize({ width: 32, height: 32, fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const raw = { width: info.width, height: info.height, channels: 4 as const };
  const { r, g, b } = (await sharp(data, { raw }).stats()).dominant;
  const hash = encode(data, info.width, info.height);
  const output = await sharp(Buffer.from(decode(hash, 16, 16)), {
    raw: { width: 16, height: 16, channels: 4 },
  })
    .webp({ quality: 20 })
    .toBuffer();
  return JSON.stringify({
    dominantColor: `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`,
    placeholderHash: hash,
    placeholder: `data:image/webp;base64,${output.toString('base64')}`,
  });
}
async function batch() {
  const outputs: string[] = [];
  for (let i = 0; i < sources.length; i++)
    outputs.push(
      pipeline
        ? await preview(sources[i]!)
        : encode(inputs[i]!.data, inputs[i]!.info.width, inputs[i]!.info.height),
    );
  return outputs;
}
const firstBegin = performance.now();
const first = await batch();
const firstBatchMs = performance.now() - firstBegin;
if (pipeline && mode.endsWith('rust')) {
  const { placeholder } = await import('../../packages/svelte-imageway/dist/vite/placeholder.js');
  for (let i = 0; i < sources.length; i++) {
    const result = await placeholder(sources[i]!, 'blurhash');
    const normalized = JSON.stringify({
      dominantColor: result.dominantColor,
      placeholderHash: result.placeholderHash,
      placeholder: result.placeholder,
    });
    if (normalized !== first[i])
      throw Error('Benchmark preview differs from the shipped pipeline.');
  }
}
for (let warmup = 0; warmup < (pipeline ? 1 : 25); warmup++) await batch();
const batches = pipeline ? 3 : 500;
let checksum = 0;
const started = performance.now();
for (let i = 0; i < batches; i++) {
  const output = await batch();
  checksum += output[i % output.length]!.charCodeAt(0);
}
console.log(
  JSON.stringify({
    mode,
    initializationMs,
    firstBatchMs,
    batches,
    operations: batches * sources.length,
    perPhotoMs: (performance.now() - started) / (batches * sources.length),
    checksum,
    outputDigest: digest(first.join('\n')),
    node: process.version,
  }),
);

import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { names } from '../photographic/common.ts';

const [packageRoot, previewArg] = process.argv.slice(2) as [string, string];
const preview = previewArg === 'preview';
const { transform } = (await import(
  pathToFileURL(join(packageRoot, 'dist/node/pipeline.js')).href
)) as typeof import('../../packages/svelte-imageway/dist/node/pipeline.js');
const { defineConfig, normalizeRequest } = (await import(
  pathToFileURL(join(packageRoot, 'dist/core/index.js')).href
)) as typeof import('../../packages/svelte-imageway/dist/core/index.js');
const config = defineConfig({ widths: [288, 384, 480], qualities: [75], quality: 75 });
const requests = [288, 384, 480].map((w) => normalizeRequest({ key: 'bench', w }, config));
const inputs = await Promise.all(
  names.map((name) => readFile(resolve('.local/photographic/corpus', name))),
);
async function batch() {
  const outputs = [];
  for (const input of inputs)
    for (const request of requests)
      outputs.push(await transform(input, request, 'webp', config, preview));
  return outputs;
}
await batch();
const begin = performance.now();
const outputs = await batch();
const elapsedMs = performance.now() - begin;
const hash = createHash('sha256');
for (const { data, ...metadata } of outputs) {
  hash.update(data);
  hash.update(JSON.stringify(metadata));
}
console.log(
  JSON.stringify({
    preview,
    perImageMs: elapsedMs / outputs.length,
    outputCount: outputs.length,
    outputDigest: hash.digest('hex'),
    peakRssBytes: process.resourceUsage().maxRSS * 1024,
  }),
);

import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const root = resolve(process.argv[2]);
const data = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="red"/></svg>',
);
const started = performance.now();
const { sniff } = await import(pathToFileURL(resolve(root, 'dist/node/pipeline.js')).href);
const importMs = performance.now() - started;
const firstStarted = performance.now();
if (sniff(data) !== 'svg') throw Error('SVG validation failed.');
const firstSVGMs = performance.now() - firstStarted;
const warmStarted = performance.now();
for (let i = 0; i < 1000; i++) if (sniff(data) !== 'svg') throw Error('SVG validation failed.');
console.log(
  JSON.stringify({
    importMs,
    firstSVGMs,
    importAndFirstSVGMs: importMs + firstSVGMs,
    warmValidationUs: ((performance.now() - warmStarted) * 1000) / 1000,
    node: process.version,
  }),
);

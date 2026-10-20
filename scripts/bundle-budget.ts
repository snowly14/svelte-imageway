import { build } from 'vite';
import { imageway } from '../packages/svelte-imageway/src/lib/vite/index.js';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { gzipSync } from 'node:zlib';
import { writeFile } from 'node:fs/promises';
const result = await build({
  configFile: false,
  logLevel: 'silent',
  plugins: [imageway(), svelte()],
  build: {
    write: false,
    minify: true,
    lib: { entry: 'packages/svelte-imageway/dist/components/Image.svelte', formats: ['es'] },
    rolldownOptions: { external: (id) => id === 'svelte' || id.startsWith('svelte/') },
  },
});
const chunks = (Array.isArray(result) ? result : [result]).flatMap((r) =>
  'output' in r ? r.output : [],
);
const js = chunks
  .filter((v) => v.type === 'chunk')
  .map((v) => v.code)
  .join('\n');
if (/node:|worker_threads|require\(["']sharp/.test(js))
  throw new Error('Server code leaked into the client entry.');
const gzip = gzipSync(js, { level: 9 }).length;
const report = {
  entry: 'Image.svelte plus all Imageway helpers',
  runtime: 'Svelte peer externalized',
  rawBytes: Buffer.byteLength(js),
  gzipBytes: gzip,
  gzipLevel: 9,
  targetBytes: 1536,
};
await writeFile('.local/base-component.js', js);
await writeFile('.local/bundle-budget.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));

const limit = process.argv.find((v) => v.startsWith('--budget='))?.split('=')[1];
if (limit && (!Number.isSafeInteger(Number(limit)) || Number(limit) <= 0))
  throw new Error('Invalid size budget.');
if (limit && gzip > Number(limit))
  throw new Error(`Image entry is ${gzip} gzip bytes; budget is ${limit}.`);

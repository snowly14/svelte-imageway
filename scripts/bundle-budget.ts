import { build } from 'vite';
import { imageway } from '../packages/svelte-imageway/src/lib/vite/index.js';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { gzipSync } from 'node:zlib';
import { writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const picture = process.argv.includes('--picture');
const packageRoot = resolve(
  process.argv.find((arg) => arg.startsWith('--package-root='))?.slice('--package-root='.length) ??
    'packages/svelte-imageway',
);
const result = await build({
  configFile: false,
  logLevel: 'silent',
  plugins: [imageway(), svelte()],
  build: {
    write: false,
    minify: true,
    lib: {
      entry: join(packageRoot, 'dist/components', picture ? 'Picture.svelte' : 'Image.svelte'),
      formats: ['es'],
    },
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
if (/node:|worker_threads|WebAssembly|blurhash\.wasm|require\(["']sharp/.test(js))
  throw new Error('Server code leaked into the client entry.');
const gzip = gzipSync(js, { level: 9 }).length;
const css = chunks
  .filter((v) => v.type === 'asset' && v.fileName.endsWith('.css'))
  .map((v) => (v.type === 'asset' ? v.source : ''))
  .map((v) => (typeof v === 'string' ? Buffer.from(v) : Buffer.from(v)));
const report = {
  entry: picture ? 'Picture.svelte' : 'Image.svelte plus all Imageway helpers',
  runtime: 'Svelte peer externalized',
  rawBytes: Buffer.byteLength(js),
  gzipBytes: gzip,
  gzipLevel: 9,
  cssBytes: css.reduce((n, value) => n + value.length, 0),
  cssGzipBytes: css.reduce((n, value) => n + gzipSync(value, { level: 9 }).length, 0),
  totalGzipBytes: gzip + css.reduce((n, value) => n + gzipSync(value, { level: 9 }).length, 0),
  targetBytes: 1536,
};
await writeFile(picture ? '.local/picture-component.js' : '.local/base-component.js', js);
await writeFile(
  picture ? '.local/picture-budget.json' : '.local/bundle-budget.json',
  JSON.stringify(report, null, 2) + '\n',
);
console.log(JSON.stringify(report, null, 2));

for (const [option, bytes] of [
  ['budget', gzip],
  ['total-budget', report.totalGzipBytes],
] as const) {
  const limit = process.argv.find((v) => v.startsWith(`--${option}=`))?.split('=')[1];
  if (limit && (!Number.isSafeInteger(Number(limit)) || Number(limit) <= 0))
    throw new Error('Invalid size budget.');
  if (limit && bytes > Number(limit))
    throw new Error(`Image ${option} is ${bytes} gzip bytes; limit is ${limit}.`);
}

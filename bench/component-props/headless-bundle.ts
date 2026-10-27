import { build } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve, join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
const rows = [];
for (const [variant, folder] of [
  ['before', '.local/component-3.1.8/baseline/package'],
  ['after', 'packages/svelte-imageway'],
] as const) {
  const pkg = resolve(folder),
    root = resolve('.local/component-3.1.8/headless', variant);
  await mkdir(root, { recursive: true });
  await writeFile(
    join(root, 'entry.js'),
    `import {getImageProps} from 'svelte-imageway';console.log(getImageProps({src:'/photo.jpg',alt:''}));`,
  );
  const { imageway } = await import(pathToFileURL(join(pkg, 'dist/vite/index.js')).href);
  const result = await build({
    root,
    configFile: false,
    logLevel: 'silent',
    plugins: [imageway(), svelte()],
    resolve: { alias: [{ find: /^svelte-imageway$/, replacement: join(pkg, 'dist/index.js') }] },
    build: { write: false, minify: true, rolldownOptions: { input: join(root, 'entry.js') } },
  });
  const output = (Array.isArray(result) ? result : [result]).flatMap((x) =>
    'output' in x ? x.output : [],
  );
  rows.push({
    variant,
    files: output.map((x) => ({
      name: x.fileName,
      bytes: x.type === 'chunk' ? x.code.length : x.source.length,
      gzip: gzipSync(
        x.type === 'chunk'
          ? x.code
          : typeof x.source === 'string'
            ? Buffer.from(x.source)
            : Buffer.from(x.source),
      ).length,
    })),
    css: output.filter((x) => x.fileName.endsWith('.css')).length,
  });
}
await writeFile(
  'bench/results/component-props-3.1.8/headless-bundle.json',
  JSON.stringify(
    {
      protocol:
        'Actual root import getImageProps only, all emitted JS/CSS, paired identical bundler; checks CSS reachability after shared stylesheet; no timing claim.',
      rows,
    },
    null,
    2,
  ) + '\n',
);
console.log(JSON.stringify(rows));

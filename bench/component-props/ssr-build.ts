import { build } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const [packageRoot, root] = process.argv.slice(2) as [string, string];
const { imageway } = await import(pathToFileURL(join(packageRoot, 'dist/vite/index.js')).href);
await build({
  root,
  configFile: false,
  logLevel: 'silent',
  resolve: {
    alias: [{ find: /^svelte-imageway$/, replacement: join(packageRoot, 'dist/index.js') }],
  },
  plugins: [imageway(), svelte()],
  ssr: { noExternal: ['svelte-imageway'] },
  build: { outDir: 'ssr', ssr: 'entry.js' },
});

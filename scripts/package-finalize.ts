import { readdir, copyFile, chmod, readFile, writeFile } from 'node:fs/promises';
import { join, relative, dirname } from 'node:path';
const root = 'packages/svelte-imageway/dist';
// NodeNext resolves arbitrary-extension declarations as *.d.svelte.ts; bundlers also
// accept svelte-package's *.svelte.d.ts. Ship both without changing component sources.
for (const name of await readdir(join(root, 'components'))) {
  if (name.endsWith('.svelte.d.ts'))
    await copyFile(
      join(root, 'components', name),
      join(root, 'components', name.replace('.svelte.d.ts', '.d.svelte.ts')),
    );
}
await chmod(join(root, 'cli/index.js'), 0o755);
// Any public type entry activates the narrowly scoped image-query declarations.
// No application scan, generated project file or runtime side-effect import.
const pkg = JSON.parse(await readFile('packages/svelte-imageway/package.json', 'utf8')) as {
  exports: Record<string, { types?: string }>;
};
for (const entry of Object.values(pkg.exports)) {
  if (!entry.types || entry.types === './dist/types.d.ts') continue;
  const file = join(root, entry.types.replace('./dist/', ''));
  let target = relative(dirname(file), join(root, 'types.d.ts')).replaceAll('\\', '/');
  if (!target.startsWith('.')) target = './' + target;
  const reference = `/// <reference path="${target}" />\n`;
  const source = await readFile(file, 'utf8');
  if (!source.startsWith(reference)) await writeFile(file, reference + source);
}

await copyFile(
  'packages/svelte-imageway/src/lib/node/blurhash.wasm',
  join(root, 'node/blurhash.wasm'),
);
await copyFile('native/blurhash/NOTICE', join(root, 'node/BLURHASH-NOTICE'));

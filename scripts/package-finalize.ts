import { readdir, copyFile, chmod } from 'node:fs/promises';
import { join } from 'node:path';
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

import { cp, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createPackControl } from './control.ts';
const base = resolve('.local/native-pack-3.1.7/baseline/package');
const optimized = resolve('.local/native-pack-3.1.7/optimized/package');
await cp(base, optimized, { recursive: true });
const file = join(optimized, 'dist/node/blurhash-encoding.js');
await cp(file, join(optimized, 'dist/node/blurhash-encoding-reference.js'));
await writeFile(
  file,
  `import {linearToSrgb} from './blurhash-encoding-reference.js';\nexport {linearToSrgb};\n${createPackControl.toString()}\nexport const packBlurhash=createPackControl();\n`,
);
// Native-only ablation uses the current column kernel with original JS packing.
const column = resolve('.local/native-pack-3.1.7/column/package');
await cp('packages/svelte-imageway', column, {
  recursive: true,
  filter: (source) => !source.includes('node_modules') && !source.includes('/src'),
});
await cp(
  join(base, 'dist/node/blurhash-encoding.js'),
  join(column, 'dist/node/blurhash-encoding.js'),
);

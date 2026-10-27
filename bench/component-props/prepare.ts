import ts from 'typescript';
import { readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { digest, execute } from '../photographic/common.ts';
const root = resolve('.local/component-3.1.8');
await mkdir(root, { recursive: true });
const original = await readFile('.local/release-3.1.7/svelte-imageway-3.1.7.tgz').catch(
  async () => {
    const response = await fetch(
      'https://registry.npmjs.org/svelte-imageway/-/svelte-imageway-3.1.7.tgz',
    );
    if (!response.ok) throw Error(`Cannot fetch baseline: ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  },
);
if (digest(original) !== 'dd67a03d7c7a27dba607a838d1460117710e8a3fecca2ff0bf16cd89e60a2535')
  throw Error('Unexpected baseline archive');
await writeFile(join(root, 'baseline.tgz'), original);
await rm(join(root, 'baseline'), { recursive: true, force: true });
await mkdir(join(root, 'baseline'), { recursive: true });
await execute('tar', ['-xzf', join(root, 'baseline.tgz'), '-C', join(root, 'baseline')]);
const control = join(root, 'allocation-control/package');
await cp('packages/svelte-imageway', control, {
  recursive: true,
  filter: (p) => !p.includes('node_modules') && !p.includes('/src'),
});
// Controlled before-provider snapshot: same component filtering/style/size fix,
// original provider URL generation. It deliberately stays out of the consumer package.
const transpiler = {
  transformSync: (source: string) =>
    ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    }).outputText,
};
await writeFile(
  join(control, 'dist/props.js'),
  transpiler.transformSync(
    (await readFile('bench/component-props/allocation-control.ts', 'utf8')).replaceAll(
      '../../packages/svelte-imageway/src/lib/core/',
      './core/',
    ),
  ),
);

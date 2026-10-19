import { join } from 'node:path';
import { create, exists, readFile, writeFile } from './files.js';
import { invariant } from '../core/errors.js';
/** Patch a literal Vite plugin array using TypeScript syntax nodes, preserving the rest of the source. */
export async function configureVite(source: string): Promise<string> {
  const ts = await import('typescript');
  const tree = ts.createSourceFile(
    'vite.config.ts',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  let alias: string | undefined;
  for (const statement of tree.statements)
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === 'svelte-imageway/vite'
    ) {
      const bindings = statement.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings))
        for (const e of bindings.elements)
          if ((e.propertyName ?? e.name).text === 'imageway') alias = e.name.text;
    }
  const calls: import('typescript').CallExpression[] = [];
  const arrays: import('typescript').ArrayLiteralExpression[] = [];
  function visit(node: import('typescript').Node) {
    if (ts.isCallExpression(node)) calls.push(node);
    if (
      ts.isPropertyAssignment(node) &&
      node.name.getText(tree).replace(/['"]/g, '') === 'plugins' &&
      ts.isArrayLiteralExpression(node.initializer)
    )
      arrays.push(node.initializer);
    ts.forEachChild(node, visit);
  }
  visit(tree);
  if (alias && calls.some((v) => v.expression.getText(tree) === alias)) return source;
  invariant(
    arrays.length === 1,
    'INIT_CONFIG',
    'Expected one literal plugins: [...] in Vite config. Add imageway() manually to a computed/multi-config project.',
  );
  const array = arrays[0]!;
  const name = alias ?? '__imagewayPlugin';
  invariant(
    alias || !new RegExp('\\b' + name + '\\b').test(source),
    'INIT_NAME',
    'Reserved init alias already exists; add imageway() manually.',
  );
  const position = array.getStart(tree) + 1;
  const output =
    source.slice(0, position) +
    `${name}(),${array.elements.length ? ' ' : ''}` +
    source.slice(position);
  return (alias ? '' : `import { imageway as ${name} } from 'svelte-imageway/vite';\n`) + output;
}
export async function init(root: string, dryRun = false) {
  invariant(
    await exists(join(root, 'package.json')),
    'INIT_PROJECT',
    'Run init inside an existing Svelte/Vite project.',
  );
  const config = (
    await Promise.all(
      ['vite.config.ts', 'vite.config.js', 'vite.config.mts', 'vite.config.mjs'].map(async (f) =>
        (await exists(join(root, f))) ? f : undefined,
      ),
    )
  ).filter((v): v is string => Boolean(v));
  invariant(
    config.length === 1,
    'INIT_VITE',
    'Expected exactly one Vite config. Create it with the official Svelte CLI first.',
  );
  const path = join(root, config[0]!);
  const source = await readFile(path, 'utf8');
  const updated = await configureVite(source);
  if (!dryRun && source !== updated) await writeFile(path, updated);
  const created: string[] = [];
  for (const [file, content] of Object.entries({
    'src/imageway.d.ts': '/// <reference types="svelte-imageway/types" />\n',
    'src/lib/imageway-example.svg':
      '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500"><rect width="800" height="500" fill="#dcefe9"/><path d="M0 500L250 100L500 500M300 500L600 150L800 500" fill="#286a59"/></svg>\n',
    'src/lib/ImagewayExample.svelte':
      '<script lang="ts">\n  import { Image } from "svelte-imageway";\n  import hero from "./imageway-example.svg?img";\n</script>\n\n<Image src={hero} alt="Illustrated mountain landscape" priority />\n',
  }))
    if (await create(join(root, file), content, dryRun)) created.push(file);
  return {
    changed: source !== updated ? [config[0]!, ...created] : created,
    dryRun,
    next: 'Render src/lib/ImagewayExample.svelte in a page, then run your Vite build.',
  };
}

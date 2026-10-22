import { relative, sep } from 'node:path';
import { files, readFile, writeFile } from './files.js';
import { invariant } from '../core/errors.js';
interface Value {
  type: string;
  data?: string;
  expression?: { type: string; name?: string };
}
interface Element {
  type?: string;
  name?: string;
  start?: number;
  end?: number;
  attributes?: {
    type: string;
    name?: string;
    value?: Value[] | Value;
    start: number;
    end: number;
  }[];
}
/** Conservative syntax-based codemod; ambiguous artifact shapes/transform directives remain review items. */
export async function migrate(root: string, from: string, write = false) {
  invariant(
    ['enhanced-img', 'imagetools', 'imageway-v1'].includes(from),
    'MIGRATE_SOURCE',
    'Use --from enhanced-img, imagetools or imageway-v1.',
  );
  const ts = await import('typescript');
  const changed: string[] = [],
    review: string[] = [];
  for (const file of await files(root, /\.(ts|js|svelte)$/)) {
    const source = await readFile(file, 'utf8');
    const edits: { start: number; end: number; text: string }[] = [];
    const imports: string[] = [];
    const converted = new Set<string>();
    const scripts: { source: string; offset: number }[] = [];
    let fragment: unknown, insertion: number | undefined;
    if (file.endsWith('.svelte')) {
      const { parse } = await import('svelte/compiler');
      const ast = parse(source, { modern: true });
      fragment = ast.fragment;
      for (const script of [ast.instance, ast.module])
        if (script) {
          const bounds = script.content as typeof script.content & { start: number; end: number };
          scripts.push({ source: source.slice(bounds.start, bounds.end), offset: bounds.start });
          if (script === ast.instance) insertion = bounds.start;
        }
    } else scripts.push({ source, offset: 0 });
    for (const script of scripts) {
      const ast = ts.createSourceFile(
        file,
        script.source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
      );
      for (const statement of ast.statements)
        if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
          const node = statement.moduleSpecifier;
          const [path, query] = node.text.split('?');
          if (!query) continue;
          const p = new URLSearchParams(query);
          if (
            !(from === 'imageway-v1'
              ? p.has('img')
              : from === 'enhanced-img'
                ? p.has('enhanced')
                : p.get('as') === 'picture')
          )
            continue;
          if (
            from !== 'imageway-v1' &&
            [...p.keys()].some((v) => !['enhanced', 'as', 'w', 'format', 'q'].includes(v))
          ) {
            review.push(
              relative(root, file).split(sep).join('/') +
                ': unsupported import directives; unchanged.',
            );
            continue;
          }
          p.delete('enhanced');
          p.delete('as');
          p.delete('img');
          const directives = (p.size ? p.toString() + '&' : '') + 'img';
          if (node.text === path + '?' + directives) continue;
          edits.push({
            start: script.offset + node.getStart(ast),
            end: script.offset + node.end,
            text: JSON.stringify(path + '?' + directives),
          });
          if (statement.importClause?.name) converted.add(statement.importClause.name.text);
        }
    }
    if (fragment && from === 'enhanced-img') {
      let used = false;
      function walk(node: unknown): void {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) {
          node.forEach(walk);
          return;
        }
        const n = node as Element;
        if (n.name === 'enhanced:img' && n.type === 'RegularElement') {
          const src = n.attributes?.find((a) => a.name === 'src'),
            value = Array.isArray(src?.value) ? src.value[0] : src?.value;
          const literal =
            value?.type === 'Text' &&
            value.data?.startsWith('./') &&
            /\.(png|jpe?g|webp|avif|svg)$/i.test(value.data);
          const imported =
            value?.type === 'ExpressionTag' &&
            value.expression?.type === 'Identifier' &&
            converted.has(value.expression.name!);
          const text = source.slice(n.start, n.end),
            empty = /\/\s*>$/.test(text);
          const safe =
            empty &&
            n.attributes?.some((a) => a.name === 'alt') &&
            !source.includes('ImagewayImageAlias') &&
            (literal || imported);
          if (!safe)
            review.push(
              relative(root, file).split(sep).join('/') +
                ': review enhanced:img dynamic source, alt or nonempty markup; unchanged.',
            );
          else {
            used = true;
            edits.push({
              start: n.start! + 1,
              end: n.start! + 1 + 'enhanced:img'.length,
              text: 'ImagewayImageAlias',
            });
            if (literal) {
              const name = '__imagewayAsset' + imports.length;
              imports.push(`import ${name} from ${JSON.stringify(value.data + '?img')};`);
              edits.push({ start: src!.start, end: src!.end, text: `src={${name}}` });
            }
          }
        }
        for (const [key, value] of Object.entries(node))
          if (!['metadata', 'loc'].includes(key)) walk(value);
      }
      walk(fragment);
      if (used) {
        imports.unshift('import { Picture as ImagewayImageAlias } from "svelte-imageway";');
        const text = '\n' + imports.join('\n') + '\n';
        edits.push({
          start: insertion ?? 0,
          end: insertion ?? 0,
          text: insertion === undefined ? '<script lang="ts">' + text + '</script>\n' : text,
        });
      }
    }
    if (edits.length) {
      let output = source;
      for (const e of edits.sort((a, b) => b.start - a.start))
        output = output.slice(0, e.start) + e.text + output.slice(e.end);
      if (write) {
        await writeFile(file + '.imageway-backup', source, { flag: 'wx' });
        await writeFile(file, output);
      }
      changed.push(relative(root, file).split(sep).join('/'));
    }
  }
  return {
    from,
    write,
    changed,
    review,
    next: 'Run init, review markup/artifact shapes, remove the previous plugin only after builds pass. Imagetools as=picture objects may need an Image src migration.',
  };
}

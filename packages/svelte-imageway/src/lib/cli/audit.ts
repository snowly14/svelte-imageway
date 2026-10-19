import { relative } from 'node:path';
import { stat } from 'node:fs/promises';
import { files, readFile } from './files.js';
export interface AuditFinding {
  file: string;
  line: number;
  code: string;
  message: string;
}
/** Static audit; dynamic spreads and LCP prediction are deliberately reported as review hints. */
export async function audit(root: string): Promise<AuditFinding[]> {
  const findings: AuditFinding[] = [];
  const { parse } = await import('svelte/compiler');
  for (const path of await files(root, /\.(svelte|md|css|png|jpe?g|gif|bmp)$/i)) {
    const name = relative(root, path);
    const add = (offset: number, code: string, message: string, source = '') =>
      findings.push({
        file: name,
        line: source.slice(0, offset).split('\n').length,
        code,
        message,
      });
    if (!/\.(svelte|md|css)$/i.test(path)) {
      if ((await stat(path)).size > 300_000)
        add(0, 'HEAVY', 'Source exceeds 300 KB; serve responsive optimized variants.');
      if (/\.(bmp|gif)$/i.test(path))
        add(
          0,
          'FORMAT',
          'Consider a modern format; animated media needs a deliberate animation policy.',
        );
      continue;
    }
    const text = await readFile(path, 'utf8');
    if (path.endsWith('.svelte')) {
      let tree: unknown;
      try {
        tree = parse(text, { modern: true });
      } catch {
        add(0, 'PARSE', 'Svelte parse failed; fix syntax before auditing.', text);
        continue;
      }
      let first = true;
      function walk(node: unknown): void {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) {
          node.forEach(walk);
          return;
        }
        const n = node as {
          type?: string;
          name?: string;
          start?: number;
          attributes?: { name?: string; type: string }[];
        };
        if (n.type === 'RegularElement' && n.name === 'img') {
          const attrs = new Set(n.attributes?.map((v) => v.name));
          const spread = n.attributes?.some((v) => v.type === 'SpreadAttribute');
          if (spread)
            add(
              n.start ?? 0,
              'DYNAMIC',
              'Review spread attributes for alt, dimensions and loading.',
              text,
            );
          else
            for (const attr of ['alt', 'width', 'height', 'loading'])
              if (!attrs.has(attr))
                add(n.start ?? 0, attr.toUpperCase(), `<img> needs ${attr}.`, text);
          if (first && !attrs.has('fetchpriority'))
            add(
              n.start ?? 0,
              'LCP_REVIEW',
              'First static image may be LCP: review eager loading, priority and preload.',
              text,
            );
          first = false;
        }
        for (const [key, value] of Object.entries(node))
          if (!['loc', 'metadata'].includes(key)) walk(value);
      }
      walk(tree);
    } else if (path.endsWith('.md')) {
      for (const match of text.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)) {
        if (!match[1])
          add(
            match.index,
            'ALT_REVIEW',
            'Empty Markdown alt: verify that the image is decorative.',
            text,
          );
        add(
          match.index,
          'MARKDOWN_IMAGE',
          'Use responsive variants and intrinsic dimensions in Markdown rendering.',
          text,
        );
      }
    } else
      for (const match of text.matchAll(/url\(\s*['"]?([^)'"\s]+\.\w+)["']?\s*\)/g))
        if (/\.(png|jpe?g|gif|bmp)$/i.test(match[1]!))
          add(
            match.index,
            'CSS_IMAGE',
            'Review responsive image-set and modern CSS background formats.',
            text,
          );
  }
  return findings;
}

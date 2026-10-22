import { readdir, lstat, readFile, mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
const ignored = new Set([
  'node_modules',
  '.git',
  '.svelte-kit',
  '.imageway',
  '.wrangler',
  'dist',
  'build',
  'coverage',
  'imageway-output',
]);
/** Do not follow symlinks or scan generated directories. */
export async function files(root: string, test: RegExp): Promise<string[]> {
  const found: string[] = [];
  async function visit(dir: string) {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      if (e.isSymbolicLink() || ignored.has(e.name) || e.name.startsWith('.')) continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) await visit(p);
      else if (e.isFile() && test.test(e.name)) found.push(p);
    }
  }
  await visit(root);
  return found.sort();
}
export async function exists(path: string): Promise<boolean> {
  try {
    return (await lstat(path)).isFile();
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw e;
  }
}
export async function create(
  path: string,
  source: string | Uint8Array,
  dryRun = false,
): Promise<boolean> {
  if (await exists(path)) return false;
  if (!dryRun) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, source, { flag: 'wx' });
  }
  return true;
}
export { readFile, writeFile };

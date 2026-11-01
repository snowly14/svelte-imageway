import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

/** Fingerprint every TS/WASM processing source, including nested directories. */
export async function processingFingerprint(root: string): Promise<string> {
  const hash = createHash('sha256');
  async function walk(folder: string, prefix: string): Promise<void> {
    const entries = await readdir(folder, { withFileTypes: true });
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      const path = join(folder, entry.name);
      const relative = `${prefix}/${entry.name}`;
      if (entry.isSymbolicLink())
        throw Error(`Processing source symlinks are unsupported: ${relative}`);
      if (entry.isDirectory()) await walk(path, relative);
      else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.wasm'))) {
        hash.update(`${relative}\n`).update(await readFile(path));
      }
    }
  }
  // Preserve the established folder ordering and path spelling across platforms.
  for (const folder of ['core', 'node', 'edge']) await walk(join(root, folder), folder);
  return hash.digest('hex');
}

import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { digest, execute } from '../photographic/common.ts';
const root = resolve('.local/component-3.1.9/upgrade-selected/round-6');
const output = resolve('bench/results/perf-3.1.9/upgrade-parity.json');
try {
  await readFile(output);
  throw Error('Preserve existing parity output.');
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
}
async function tree(path: string, includeMtime: boolean) {
  const files: Array<{ path: string; size: string; sha256?: string; mtimeNs?: string }> = [];
  async function walk(dir: string): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const file = join(dir, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (entry.isFile()) {
        const info = await stat(file, { bigint: true });
        files.push({
          path: relative(path, file).replaceAll('\\', '/'),
          size: info.size.toString(),
          ...(includeMtime
            ? { mtimeNs: info.mtimeNs.toString() }
            : { sha256: digest(await readFile(file)) }),
        });
      }
    }
  }
  await walk(path);
  return files.toSorted((a, b) => a.path.localeCompare(b.path));
}
const cacheRoot = join(root, 'node_modules/.cache');
const beforeCache = await tree(cacheRoot, true);
const rows = [];
for (const [variant, pkg] of [
  ['baseline', '.local/component-3.1.9/baseline/package'],
  ['selected', '.local/component-3.1.9/approved/package'],
] as const) {
  await execute(
    'node',
    [resolve('bench/improvements/child.ts'), 'build', resolve(pkg), root, 'automatic'],
    { cwd: root, timeout: 300000, maxBuffer: 2000000 },
  );
  const files = await tree(join(root, 'dist'), false);
  rows.push({ variant, fileCount: files.length, digest: digest(JSON.stringify(files)), files });
}
const afterCache = await tree(cacheRoot, true);
if (
  rows[0]!.digest !== rows[1]!.digest ||
  JSON.stringify(beforeCache) !== JSON.stringify(afterCache)
)
  throw Error('Output file/URL or cache metadata parity failed.');
await writeFile(
  output,
  JSON.stringify(
    {
      protocol:
        'One additional hot baseline/selected pair in the same populated root after the seven upgrade-selected trials. Every output file path, size and SHA-256, including generated JS and HTML, must match. All cache file paths, sizes and nanosecond modification times must remain unchanged.',
      cacheFiles: beforeCache.length,
      cacheFingerprint: digest(JSON.stringify(beforeCache)),
      rows,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  'All output files and cache entries match across the actual 3.1.8-to-3.1.9 transition.',
);

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
const exec = promisify(execFile);
const directory = resolve('packages/svelte-imageway');
const out = resolve('.local/pack');
await mkdir(out, { recursive: true });
async function run(command: string, args: string[], cwd = process.cwd()) {
  const result = await exec(command, args, {
    cwd,
    maxBuffer: 8_000_000,
    shell: process.platform === 'win32',
  });
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  return result.stdout;
}
await run('bun', ['run', 'publint', directory]);
await run('bun', ['pm', 'pack', '--destination', out], directory);
const pkg = JSON.parse(await readFile(directory + '/package.json', 'utf8')) as { version: string };
const archive = resolve(out, `svelte-imageway-${pkg.version}.tgz`);
const tar = gunzipSync(await readFile(archive));
const files: string[] = [];
for (let offset = 0; offset + 512 <= tar.length;) {
  const header = tar.subarray(offset, offset + 512);
  const name = header.subarray(0, 100).toString().replace(/\0.*$/, '');
  if (!name) break;
  const size = parseInt(header.subarray(124, 136).toString().replace(/\0.*$/, '').trim(), 8) || 0;
  const type = String.fromCharCode(header[156]!);
  if (type !== 'x' && type !== 'g') {
    if (!/^package\/(?:dist\/|README\.md$|LICENSE$|CHANGELOG\.md$|package\.json$)/.test(name))
      throw new Error('Unexpected packed path: ' + name);
    if (name.includes('..') || /(?:\.env|\.dev.vars|node_modules|\.local)\//.test(name))
      throw new Error('Unsafe packed path: ' + name);
    files.push(name);
  }
  offset += 512 + Math.ceil(size / 512) * 512;
}
for (const required of [
  'README.md',
  'LICENSE',
  'package.json',
  'dist/cli/index.js',
  'dist/node/sharp-worker.js',
  'dist/node/blurhash.wasm',
  'dist/node/BLURHASH-NOTICE',
  'dist/components/Image.d.svelte.ts',
])
  if (!files.includes('package/' + required)) throw new Error('Missing packed file: ' + required);
if (
  files.some((file) =>
    /(?:StaticImage|StaticPicture|static-props|\/static(?:-picture)?\.)/.test(file),
  )
)
  throw new Error('Removed static image API leaked into the package.');
// ESM-only is the supported contract. Legacy Node10 resolution and CJS require
// are not advertised; no internal-resolution rules are disabled.
await run('bun', ['run', 'attw', '--profile', 'esm-only', archive]);
const dry = await run('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], directory);
await writeFile('.local/npm-pack-dry-run.json', dry);
await writeFile(
  '.local/package-check.json',
  JSON.stringify({ archive, files, count: files.length }, null, 2) + '\n',
);

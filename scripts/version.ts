import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const base = 'packages/svelte-imageway/src/lib';
const hash = createHash('sha256');
for (const folder of ['core', 'node', 'edge'])
  for (const file of (await readdir(join(base, folder))).sort())
    if (file.endsWith('.ts')) {
      hash.update(`${folder}/${file}\n`);
      hash.update(await readFile(join(base, folder, file)));
    }
const version = JSON.parse(await readFile('packages/svelte-imageway/package.json', 'utf8'))
  .version as string;
const source = `// Generated at build time from the package version and processing sources.\nexport const PACKAGE_VERSION = ${JSON.stringify(version)};\nexport const PIPELINE_REVISION = ${JSON.stringify(hash.digest('hex'))};\n`;
const path = join(base, 'version.ts');
if ((await readFile(path, 'utf8').catch(() => '')) !== source) await writeFile(path, source);

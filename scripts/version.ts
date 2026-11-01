import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cacheRevision } from './cache-revision.ts';
import { processingFingerprint } from './processing-fingerprint.ts';
const base = 'packages/svelte-imageway/src/lib';
const implementation = await processingFingerprint(base);
const version = JSON.parse(await readFile('packages/svelte-imageway/package.json', 'utf8'))
  .version as string;
const source = `// Generated at build time from the package version and processing sources.\nexport const PACKAGE_VERSION = ${JSON.stringify(version)};\nexport const PIPELINE_REVISION = ${JSON.stringify(cacheRevision(implementation))};\n`;
const path = join(base, 'version.ts');
if ((await readFile(path, 'utf8').catch(() => '')) !== source) await writeFile(path, source);

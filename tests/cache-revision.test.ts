import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { cacheRevision } from '../scripts/cache-revision.js';
import { PIPELINE_REVISION } from '../packages/svelte-imageway/src/lib/version.js';

it('aliases only the reviewed complete source fingerprint and invalidates other trees', () => {
  const reviewed = 'e3c96d43f9d137a68e28d89852216013ea7cb0f1868dc184df2a4331b380b03a';
  const prior = 'b20ae906366d6af637b09e1d0f745f64638c030dfb49e3f5efab67454b7ad77f';
  expect(cacheRevision(reviewed)).toBe(prior);
  expect(cacheRevision(prior)).toBe(prior);
  for (let i = 0; i < reviewed.length; i++) {
    const changed =
      reviewed.slice(0, i) + (reviewed[i] === 'a' ? 'b' : 'a') + reviewed.slice(i + 1);
    expect(cacheRevision(changed)).toBe(changed);
  }
});
it('generates the cache revision from the complete processing source fingerprint', async () => {
  const root = resolve('packages/svelte-imageway/src/lib');
  const hash = createHash('sha256');
  const changed = createHash('sha256');
  for (const folder of ['core', 'node', 'edge'])
    for (const name of (await readdir(join(root, folder))).sort())
      if (name.endsWith('.ts') || name.endsWith('.wasm')) {
        const path = `${folder}/${name}\n`;
        const bytes = await readFile(join(root, folder, name));
        hash.update(path).update(bytes);
        changed.update(path).update(bytes);
        if (folder === 'node' && name === 'pipeline.ts')
          changed.update('\n// Simulated future processing change.\n');
      }
  expect(PIPELINE_REVISION).toBe(cacheRevision(hash.digest('hex')));
  const changedHash = changed.digest('hex');
  expect(cacheRevision(changedHash)).toBe(changedHash);
  expect(cacheRevision(changedHash)).not.toBe(PIPELINE_REVISION);
});

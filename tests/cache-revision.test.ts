import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, cp, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { cacheRevision } from '../scripts/cache-revision.js';
import { processingFingerprint } from '../scripts/processing-fingerprint.js';
import { PIPELINE_REVISION } from '../packages/svelte-imageway/src/lib/version.js';

it.each([
  'e3c96d43f9d137a68e28d89852216013ea7cb0f1868dc184df2a4331b380b03a',
  '12aa23a1e998811a0e5e7d70960fa6375af644312e826115ab19b54970cbcc94',
])('aliases only the reviewed complete source fingerprint %s', (reviewed) => {
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
  const implementation = await processingFingerprint(root);
  expect(PIPELINE_REVISION).toBe(cacheRevision(implementation));
  const temporary = await mkdtemp(join(tmpdir(), 'imageway-fingerprint-'));
  try {
    for (const folder of ['core', 'node', 'edge'])
      await cp(join(root, folder), join(temporary, folder), { recursive: true });
    expect(await processingFingerprint(temporary)).toBe(implementation);
    await mkdir(join(temporary, 'node/future'), { recursive: true });
    await writeFile(join(temporary, 'node/future/processing.ts'), 'export const changed = true;');
    const changedHash = await processingFingerprint(temporary);
    expect(changedHash).not.toBe(implementation);
    expect(cacheRevision(changedHash)).toBe(changedHash);
    expect(cacheRevision(changedHash)).not.toBe(PIPELINE_REVISION);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

it('fingerprints nested TS and WASM sources in stable path order', async () => {
  const root = await mkdtemp(join(tmpdir(), 'imageway-fingerprint-order-'));
  try {
    for (const folder of ['core', 'node/deep', 'edge'])
      await mkdir(join(root, folder), { recursive: true });
    await writeFile(join(root, 'node/deep/b.wasm'), Buffer.from([1, 2]));
    await writeFile(join(root, 'core/a.ts'), 'a');
    await writeFile(join(root, 'edge/validate.ts'), 'e');
    const expected = createHash('sha256')
      .update('core/a.ts\n')
      .update('a')
      .update('node/deep/b.wasm\n')
      .update(Buffer.from([1, 2]))
      .update('edge/validate.ts\n')
      .update('e')
      .digest('hex');
    expect(await processingFingerprint(root)).toBe(expected);
    await writeFile(join(root, 'edge/validate.ts'), 'e2');
    expect(await processingFingerprint(root)).not.toBe(expected);
    await writeFile(join(root, 'edge/validate.ts'), 'e');
    await writeFile(join(root, 'node/deep/b.wasm'), Buffer.from([1, 3]));
    expect(await processingFingerprint(root)).not.toBe(expected);
    await symlink(join(root, 'core/a.ts'), join(root, 'node/linked.ts'), 'file');
    await expect(processingFingerprint(root)).rejects.toThrow(/symlinks/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

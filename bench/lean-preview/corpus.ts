import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { digest, names } from '../photographic/common.ts';
/** Revalidate every local source against the committed photographic manifest. */
export async function verifyCorpus() {
  const manifest = JSON.parse(
    await readFile('bench/results/photographic-3.0.1/corpus.json', 'utf8'),
  ) as Array<{ name: string; sha256: string }>;
  if (manifest.length !== names.length) throw Error('Incomplete pinned corpus manifest.');
  const rows = [];
  for (const name of names) {
    const sha256 = digest(await readFile(resolve('.local/photographic/corpus', name)));
    if (manifest.find((row) => row.name === name)?.sha256 !== sha256)
      throw Error(`Corpus hash mismatch: ${name}`);
    rows.push({ name, sha256 });
  }
  return rows;
}

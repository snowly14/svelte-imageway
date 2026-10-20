import { readFile, writeFile } from 'node:fs/promises';
const path = 'packages/svelte-imageway/package.json';
const pkg = JSON.parse(await readFile(path, 'utf8'));
const repository = process.env.IMAGEWAY_REPOSITORY;
if (repository) {
  const url = new URL(repository);
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'github.com' ||
    url.username ||
    url.password ||
    !/^\/[\w.-]+\/[\w.-]+\/?$/.test(url.pathname)
  )
    throw new Error(
      'IMAGEWAY_REPOSITORY must be the actual public https://github.com/owner/repository URL.',
    );
  const base = url.href.replace(/\/$/, '').replace(/\.git$/, '');
  pkg.repository = { type: 'git', url: base + '.git', directory: 'packages/svelte-imageway' };
  pkg.bugs = { url: base + '/issues' };
  pkg.homepage = base + '#readme';
  if (process.env.IMAGEWAY_FUNDING) {
    const funding = new URL(process.env.IMAGEWAY_FUNDING);
    if (funding.protocol !== 'https:') throw new Error('Funding must use HTTPS.');
    pkg.funding = funding.href;
  }
  await writeFile(path, JSON.stringify(pkg, null, 2) + '\n');
} else if (!pkg.repository?.url || !pkg.bugs?.url || !pkg.homepage) {
  throw new Error(
    'Release identity is not configured. Set IMAGEWAY_REPOSITORY to the actual public repository, run release:metadata, review and commit. Funding is omitted unless a real URL is supplied.',
  );
}
console.log('Public repository metadata is configured.');

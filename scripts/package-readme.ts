import { readFile } from 'node:fs/promises';
/** Keep npm documentation synchronized with the root README and resolve its repository links. */
export async function packageReadme(): Promise<string> {
  const pkg = JSON.parse(await readFile('packages/svelte-imageway/package.json', 'utf8')) as {
    repository: { url: string };
  };
  const repository = pkg.repository.url.replace(/\.git$/, '').replace(/\/$/, '');
  const source = await readFile('README.md', 'utf8');
  return (
    '<!-- Generated from the root README by scripts/package-readme.ts. -->\n\n' +
    source.replace(
      /(\[[^\]]+\]\()([^\s)]+)(\))/g,
      (match, before: string, target: string, after: string) =>
        /^(?:[a-z][\w+.-]*:|#|\/)/i.test(target)
          ? match
          : `${before}${repository}/blob/main/${target}${after}`,
    )
  );
}

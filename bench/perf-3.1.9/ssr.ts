import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { digest, environment, execute, summary } from '../photographic/common.ts';
const directory =
  process.argv.find((v) => v.startsWith('--output-dir='))?.slice('--output-dir='.length) ??
  'bench/results/perf-3.1.9';
await mkdir(directory, { recursive: true });
try {
  await readFile(directory + '/ssr.json');
  throw Error('Preserve existing data');
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
}
if (
  digest(await readFile('.local/release-3.1.8/svelte-imageway-3.1.8.tgz')) !==
  '7d4b09a7140a79204c4b4a77bf8fabecc81c8aecc7d16c09b016ce549efd9480'
)
  throw Error('Unexpected baseline archive');
const roots: Record<string, string> = {};
for (const scenario of ['Image', 'Picture', 'Both'])
  for (const variant of ['before', 'after']) {
    const root = resolve('.local/component-3.1.9/ssr', scenario, variant);
    roots[scenario + '/' + variant] = root;
    await mkdir(root, { recursive: true });
    await writeFile(
      join(root, 'App.svelte'),
      `<script>import {Image,Picture} from 'svelte-imageway';const photo={src:'/photo.jpg',srcset:'/small.jpg 320w, /photo.jpg 640w',img:{src:'/photo.webp',srcset:'/small.webp 320w, /photo.webp 640w',width:640,height:400,type:'image/webp'},sources:[{type:'image/avif',srcset:'/small.avif 320w, /photo.avif 640w'}],width:640,height:400,aspectRatio:1.6,placeholder:'data:image/webp;base64,YWJj',dominantColor:'#123456'};</script>{#snippet waiting()}<span>Waiting</span>{/snippet}{#each Array.from({length:24}) as _,i}${scenario === 'Both' ? ['Image', 'Picture'].map((component) => `<${component} src={photo} alt={'Photo '+i} priority={i===0} sizes='sm:100vw md:50vw' loadingContent={waiting} style='border:0'/>`).join('') : `<${scenario} src={photo} alt={'Photo '+i} priority={i===0} sizes='sm:100vw md:50vw' loadingContent={waiting} style='border:0'/>`}{/each}`,
    );
    await writeFile(
      join(root, 'entry.js'),
      `import {render} from 'svelte/server';import App from './App.svelte';export function page(){return render(App);}`,
    );
    await execute(
      'node',
      [
        resolve('bench/component-props/ssr-build.ts'),
        resolve(
          variant === 'before'
            ? '.local/component-3.1.9/baseline/package'
            : 'packages/svelte-imageway',
        ),
        root,
      ],
      { timeout: 120000, maxBuffer: 1000000 },
    );
  }
const rows: Array<{
    scenario: string;
    variant: string;
    round: number;
    perRenderMs: number;
    digest: string;
    peakRssBytes: number;
  }> = [],
  env = await environment();
for (const scenario of ['Image', 'Picture', 'Both'])
  for (let round = 0; round < 7; round++)
    for (const variant of round % 2 ? ['after', 'before'] : ['before', 'after']) {
      const { stdout } = await execute(
        'node',
        [resolve('bench/perf-3.1.9/ssr-child.ts'), roots[scenario + '/' + variant]!],
        { timeout: 120000, maxBuffer: 1000000 },
      );
      const row = JSON.parse(stdout.trim()) as (typeof rows)[number];
      if (rows.some((r) => r.scenario === scenario && r.digest !== row.digest))
        throw Error('SSR HTML changed');
      rows.push({ ...row, scenario, variant, round });
      await writeFile(
        directory + '/ssr.json',
        JSON.stringify(
          {
            complete: rows.length === 42,
            environment: env,
            protocol:
              'Six compiled SSR fixtures outside timing; each App has24Image/24Picture/24pairs, real snippets/native attrs/preload/placeholders/valid size shorthand;7alternating fresh-Node pairs,100warm App renders then500timed renders;consume complete HTML, include all output allocations. Complete HTML digest must match byte-for-byte, without normalization. Report per App render, not per image or browser render.',
            rows,
          },
          null,
          2,
        ) + '\n',
      );
    }
await writeFile(
  directory + '/ssr-summary.json',
  JSON.stringify(
    ['Image', 'Picture', 'Both'].map((scenario) => ({
      scenario,
      ...Object.fromEntries(
        ['before', 'after'].map((variant) => [
          variant,
          summary(
            rows
              .filter((r) => r.scenario === scenario && r.variant === variant)
              .map((r) => r.perRenderMs * 1000),
          ),
        ]),
      ),
    })),
    null,
    2,
  ) + '\n',
);

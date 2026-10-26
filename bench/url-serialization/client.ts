import { verifyCorpus } from '../lean-preview/corpus.ts';
import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { environment, execute, digest } from '../photographic/common.ts';
const baseline = resolve('.local/url-3.1.6/baseline/package');
if (
  digest(await readFile('.local/release-3.1.5/svelte-imageway-3.1.5.tgz')) !==
  '09b1a5257093f31a32bb9ebfde22e3b61dd77cc16d6c1268c9cf68cd4a233841'
)
  throw Error('Unexpected baseline archive.');
const resultDir = resolve('bench/results/url-serialization-3.1.6');
await mkdir(resultDir, { recursive: true });
const corpus = await verifyCorpus();
const env = await environment();
const rows: Array<{
  scenario: string;
  variant: string;
  pair: number;
  jsBytes: number;
  cssBytes: number;
  jsGzipBytes: number;
  cssGzipBytes: number;
  totalGzipBytes: number;
  assets: Array<{ bytes: number; sha256: string }>;
}> = [];
for (const scenario of ['Image', 'Picture', 'Both', 'LocalImage', 'LocalPicture', 'LocalBoth']) {
  const component = scenario.replace('Local', '');
  let expected: string | undefined;
  for (let pair = 0; pair < 7; pair++)
    for (const variant of pair % 2 ? ['after', 'before'] : ['before', 'after']) {
      const root = resolve('.local/url-3.1.6/client', scenario, variant);
      await mkdir(root, { recursive: true });
      await cp('.local/photographic/corpus/kodim01.png', join(root, 'photo.png'));
      await writeFile(
        join(root, 'index.html'),
        '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="app"></div><script type="module" src="/main.js"></script></body></html>',
      );
      await writeFile(
        join(root, 'App.svelte'),
        `<script>import {Image,Picture} from 'svelte-imageway';import photo from './photo.png';</script>${component === 'Both' ? '<Image src={photo} alt="Image photo" priority/><Picture src={photo} alt="Picture photo"/>' : `<${component} src={photo} alt="Photo" priority/>`}`,
      );
      await writeFile(
        join(root, 'main.js'),
        'import {hydrate} from "svelte";import App from "./App.svelte";hydrate(App,{target:document.getElementById("app"),recover:false});globalThis.__imagewayHydrated=true;',
      );
      await writeFile(
        join(root, 'ssr.js'),
        'import {render} from "svelte/server";import App from "./App.svelte";export function page(){return render(App)}',
      );
      await rm(join(root, 'node_modules/.cache'), { recursive: true, force: true });
      const { stdout } = await execute(
        'node',
        [
          resolve('bench/url-serialization/client-child.ts'),
          variant === 'before' ? baseline : resolve('packages/svelte-imageway'),
          root,
          scenario.startsWith('Local') ? 'local' : 'plain',
        ],
        { timeout: 300000, maxBuffer: 1_000_000 },
      );
      const result = JSON.parse(stdout.trim()) as (typeof rows)[number];
      const actual = JSON.stringify(result.assets);
      expected ??= actual;
      if (expected !== actual) throw Error('Image asset bytes changed.');
      rows.push({ ...result, scenario, variant, pair });
      await writeFile(
        join(resultDir, 'clients.json'),
        JSON.stringify(
          {
            complete: rows.length === 84,
            environment: env,
            corpus,
            protocol:
              'Seven alternating fresh-process builds per plain/configured-local Image/Picture/Both fixture, actual ordinary import and SSR/hydration entry. Same compiler, published 3.1.5 baseline vs candidate, empty tool cache each time. No timing claim; gzip9 JS and CSS counted separately and summed per emitted file, including Svelte. Image byte/SHA multisets must match; no server WASM in browser. Every serialized provider alias resolves to the same package variant. Both fixture detects duplicated CSS/runtime overhead. Ordinary registered imports still load actual byte-identical optimized assets; URL contract correctness is separately gated.',
            rows,
          },
          null,
          2,
        ) + '\n',
      );
      console.log(
        `${scenario} ${pair + 1}/7 ${variant}: ${result.jsGzipBytes} JS + ${result.cssGzipBytes} CSS = ${result.totalGzipBytes} gzip bytes`,
      );
    }
}

import { mkdir, cp, readFile, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { execute, environment, prepare, summary, digest } from '../photographic/common.ts';

const baseline = resolve(process.argv[2] ?? '.local/perf-3.1/baseline/package');
const candidate = resolve('packages/svelte-imageway');
const stage = process.argv[3];
if (stage && !['build', 'preview', 'client', 'histogram'].includes(stage))
  throw Error('Expected build, preview or client.');
const resultDir = resolve('bench/results/improvements-3.1');
const work = resolve('.local/perf-3.1/work');
await prepare();
await mkdir(resultDir, { recursive: true });
const env = await environment();
const baselineTar = await readFile('.local/release-3.0.1/svelte-imageway-3.0.1.tgz');
if (digest(baselineTar) !== '9c681cc39e4bdb2116ad24de59d49b650f4c58283294edacd73c4958db0c15e2')
  throw Error('Baseline must be the verified npm 3.0.1 tarball.');
const source = {
  baselineVersion: '3.0.1',
  baselineTarSha256: digest(baselineTar),
  baselinePackage: JSON.parse(await readFile(join(baseline, 'package.json'), 'utf8')).version,
  candidatePackage: JSON.parse(await readFile(join(candidate, 'package.json'), 'utf8')).version,
};
const names = Array.from({ length: 24 }, (_, i) => `kodim${String(i + 1).padStart(2, '0')}.png`);
interface Row {
  pair: number;
  variant: string;
  scenario: string;
  cache: string;
  buildMs?: number;
  perPhotoMs?: number;
  firstBatchMs?: number;
  initializationMs?: number;
  peakRssBytes: number;
  jsGzipBytes?: number;
  outputDigest?: string;
  assets?: Array<{ bytes: number; sha256: string }>;
  serverDefaultsPresent?: boolean;
  wasmPresent?: boolean;
  processWallMs: number;
}
const rows: Row[] = [];
const scenarios =
  stage === 'preview'
    ? ['color', 'lqip', 'blurhash', 'thumbhash']
    : stage === 'histogram'
      ? ['histogram']
      : stage === 'client'
        ? ['Image', 'Picture']
        : ['responsive', 'lqip-build', 'automatic'];
for (const scenario of scenarios) {
  const mode =
    stage === 'preview'
      ? 'preview'
      : stage === 'histogram'
        ? 'histogram'
        : stage === 'client'
          ? 'client'
          : 'build';
  const pairs = scenario === 'automatic' ? 3 : 7;
  let expected: string | undefined;
  for (let pair = 0; pair < pairs; pair++)
    for (const variant of pair % 2 ? ['after', 'before'] : ['before', 'after']) {
      const root = join(work, scenario, variant);
      await mkdir(root, { recursive: true });
      if (mode !== 'preview' && mode !== 'histogram') {
        for (const name of mode === 'client' ? names.slice(0, 1) : names)
          await cp(join('.local/photographic/corpus', name), join(root, name));
        await writeFile(
          join(root, 'index.html'),
          '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="app"></div><script type="module" src="/main.js"></script></body></html>',
        );
        if (mode === 'client') {
          await writeFile(
            join(root, 'App.svelte'),
            `<script>import {${scenario}} from 'svelte-imageway';import photo from './kodim01.png';</script><${scenario} src={photo} alt="Photograph" priority />`,
          );
          await writeFile(
            join(root, 'main.js'),
            'import {hydrate} from "svelte";import App from "./App.svelte";hydrate(App,{target:document.getElementById("app"),recover:false});globalThis.__imagewayHydrated=true;',
          );
          await writeFile(
            join(root, 'ssr.js'),
            'import {render} from "svelte/server";import App from "./App.svelte";export function page(){return render(App)}',
          );
        } else {
          const query =
            scenario === 'automatic'
              ? ''
              : `?img&w=288;384;480&format=webp&q=75&fit=inside&placeholder=${scenario === 'lqip-build' ? 'lqip' : 'none'}`;
          await writeFile(
            join(root, 'main.js'),
            names
              .map((name, i) => `import p${i} from './${name}${query}';console.log(p${i});`)
              .join('\n'),
          );
        }
        await rm(join(root, 'node_modules/.cache'), { recursive: true, force: true });
      }
      for (const cache of mode === 'build' ? ['cold', 'warm'] : ['warm-loop']) {
        const started = performance.now();
        const { stdout } = await execute(
          'node',
          [
            resolve('bench/improvements/child.ts'),
            mode,
            variant === 'before' ? baseline : candidate,
            root,
            mode === 'histogram' ? (variant === 'before' ? 'js' : 'rust') : scenario,
          ],
          { cwd: process.cwd(), maxBuffer: 2_000_000, timeout: 300000 },
        );
        const result = JSON.parse(stdout.trim()) as Omit<
          Row,
          'pair' | 'variant' | 'scenario' | 'cache' | 'processWallMs'
        >;
        const actual =
          mode === 'preview' || mode === 'histogram'
            ? result.outputDigest!
            : JSON.stringify(result.assets);
        expected ??= actual;
        if (expected !== actual) throw Error(`Output changed: ${scenario}/${variant}/${cache}`);
        if (mode === 'client' && result.wasmPresent)
          throw Error('Server kernel entered browser bundle.');
        rows.push({
          ...result,
          pair,
          variant,
          scenario,
          cache,
          processWallMs: performance.now() - started,
        });
        await writeFile(
          join(resultDir, (stage ?? 'build') + '.json'),
          JSON.stringify(
            {
              environment: env,
              source,
              protocol:
                'Alternating baseline/current pairs, fresh Node per candidate. Same 24 pinned Kodak images. Seven pairs for responsive/lqip-build/preview/client; three default automatic-import pairs. Persistent tool cache deleted before each cold build; warm keeps cache, OS cache unflushed. All emitted image digest/byte multisets or complete preview JSON digests must match. Preview reads sources before timer, one first 24-photo batch, one warmup batch, three timed batches (72 previews). Client mounts real Svelte Image/Picture, includes Svelte runtime; gzip9. Isolated entry output budgets measured separately. No simultaneous heavy checks; uncontrolled desktop. processWallMs also includes process setup and validation.',
              rows,
            },
            null,
            2,
          ) + '\n',
        );
        console.log(
          `${scenario} ${pair + 1}/${pairs} ${variant} ${cache}: ${result.buildMs?.toFixed(1) ?? result.perPhotoMs?.toFixed(3)} ms; JS ${result.jsGzipBytes ?? '-'} bytes`,
        );
      }
    }
}
const summaries = scenarios.flatMap((scenario) =>
  ['before', 'after'].flatMap((variant) =>
    [...new Set(rows.filter((r) => r.scenario === scenario).map((r) => r.cache))].map((cache) => {
      const selected = rows.filter(
        (r) => r.scenario === scenario && r.variant === variant && r.cache === cache,
      );
      return {
        scenario,
        variant,
        cache,
        timing: summary(selected.map((r) => r.buildMs ?? r.perPhotoMs!)),
        processWallMs: summary(selected.map((r) => r.processWallMs)),
        peakRssBytes: summary(selected.map((r) => r.peakRssBytes)),
        jsGzipBytes: selected[0]!.jsGzipBytes,
        serverDefaultsPresent: selected[0]!.serverDefaultsPresent,
        initializationMs:
          selected[0]!.initializationMs === undefined
            ? undefined
            : summary(selected.map((r) => r.initializationMs!)),
        firstBatchMs:
          selected[0]!.firstBatchMs === undefined
            ? undefined
            : summary(selected.map((r) => r.firstBatchMs!)),
      };
    }),
  ),
);
await writeFile(
  join(resultDir, (stage ?? 'build') + '-summary.json'),
  JSON.stringify(summaries, null, 2) + '\n',
);

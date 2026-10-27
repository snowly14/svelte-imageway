import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { digest } from '../photographic/common.ts';
import type { ImageOptions } from '../../packages/svelte-imageway/src/lib/props.js';
const [root, scenario] = process.argv.slice(2) as [string, string];
const initialized = performance.now();
const { getImageProps } = (await import(
  pathToFileURL(join(root, 'dist/props.js')).href
)) as typeof import('../../packages/svelte-imageway/src/lib/props.js');
const { registerImageArtifact } = (await import(
  pathToFileURL(join(root, 'dist/core/artifact.js')).href
)) as typeof import('../../packages/svelte-imageway/src/lib/core/artifact.js');
const { local } = (await import(
  pathToFileURL(join(root, 'dist/providers/local.js')).href
)) as typeof import('../../packages/svelte-imageway/src/lib/providers/local.js');
const key = Symbol.for('svelte-imageway.assets.v2');
const inputs: ImageOptions[] = Array.from({ length: 24 }, (_, i) => {
  const src =
    scenario === 'absolute' || scenario === 'mapped'
      ? `https://images.example/${i}.jpg`
      : `/uploads/${i}.jpg`;
  if (scenario === 'registered' || scenario === 'shorthand' || scenario === 'art')
    registerImageArtifact(src, {
      src: `/optimized/${i}.jpg`,
      srcset: `/optimized/${i}-320.jpg 320w, /optimized/${i}.jpg 640w`,
      width: 640,
      height: 400,
      aspectRatio: 1.6,
      sources: [],
      ...(scenario === 'art'
        ? { dominantColor: '#123456', placeholder: 'data:image/webp;base64,YWJj' }
        : {}),
    });
  const config: ImageOptions['config'] =
    scenario === 'local-provider'
      ? { provider: local() }
      : scenario === 'empty-map'
        ? { providers: {} }
        : scenario === 'mapped'
          ? { providers: { 'images.example': local() } }
          : undefined;
  return {
    src,
    alt: `Photo ${i}`,
    width: 640,
    height: 400,
    formatStrategy: 'img',
    ...(scenario === 'shorthand' ? { sizes: 'sm:100vw md:50vw lg:33vw xl:25vw' } : {}),
    ...(scenario === 'art'
      ? {
          fit: 'outside' as const,
          position: 'top-left' as const,
          style: 'border:0',
          transitionName: 'hero',
          contentVisibility: 'auto' as const,
        }
      : {}),
    ...(config ? { config } : {}),
  };
});
const initializationMs = performance.now() - initialized;
const batch = () => inputs.map(getImageProps);
const before = Object.hasOwn(globalThis, key);
const started = performance.now(),
  first = batch(),
  firstBatchMs = performance.now() - started;
const after = Object.hasOwn(globalThis, key);
for (let i = 0; i < 1000; i++) batch();
let checksum = 0;
const cpu = process.cpuUsage();
const timed = performance.now();
for (let i = 0; i < (scenario === 'mapped' || scenario === 'local-provider' ? 1000 : 10000); i++)
  for (const output of batch())
    checksum +=
      String(output.src).length + String(output.style).length + String(output.srcset).length;
const perOperationMs =
  (performance.now() - timed) /
  (scenario === 'mapped' || scenario === 'local-provider' ? 24000 : 240000);
const usage = process.cpuUsage(cpu);
const canonical = first.map((output) =>
  Object.fromEntries(Object.entries(output).sort(([a], [b]) => a.localeCompare(b))),
);
console.log(
  JSON.stringify({
    scenario,
    perOperationMs,
    cpuMicrosecondsPerOperation:
      (usage.user + usage.system) /
      (scenario === 'mapped' || scenario === 'local-provider' ? 24000 : 240000),
    initializationMs,
    firstBatchMs,
    checksum,
    digest: digest(JSON.stringify(canonical)),
    registryBefore: before,
    registryAfter: after,
    peakRssBytes: process.resourceUsage().maxRSS * 1024,
    node: process.version,
    packageRoot: resolve(root),
  }),
);

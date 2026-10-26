import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { digest } from '../photographic/common.ts';
import { canonicalControl } from './control.ts';
import type { ImageRequest } from '../../packages/svelte-imageway/src/lib/core/types.js';
const [root, mode, control = ''] = process.argv.slice(2) as [string, string, string];
const initialized = performance.now();
const core = (await import(
  pathToFileURL(join(root, 'dist/core/url.js')).href
)) as typeof import('../../packages/svelte-imageway/src/lib/core/url.js');
const inputs: ImageRequest[] = Array.from({ length: 24 }, (_, i) =>
  mode === 'escaped'
    ? { key: `folder ${i}/é雪!()*'\n.png`, w: 320, q: 75, sig: i % 2 ? 'a_b-1' : undefined }
    : {
        ...(i % 2
          ? { url: `https://images.example/${i}/é.png?x=a%2Fb&v=1` }
          : { key: `images/${i}.png` }),
        w: i % 2 ? 640 : 320,
        q: 75,
        format: 'webp',
        sig: i % 3 ? 'a_b-1' : undefined,
      },
);
let batch: () => unknown[],
  iterations = 2000;
let outputBytes: number | undefined;
if (mode === 'processor') {
  const { ImageProcessor } = (await import(
    pathToFileURL(join(root, 'dist/node/processor.js')).href
  )) as typeof import('../../packages/svelte-imageway/src/lib/node/processor.js');
  const processor = new ImageProcessor({
    directory: resolve(process.argv[5]!),
    memoryBytes: 32000000,
  });
  const source = processor.prepare(await readFile('.local/bench/fixtures/texture.jpg'));
  const request = { key: 'bench', w: 960, q: 75 };
  const first = await source.process(request, 'webp', undefined, false);
  outputBytes = first.data.length;
  for (let i = 0; i < 50; i++) await source.process(request, 'webp', undefined, false);
  const cpu = process.cpuUsage(),
    started = performance.now();
  let checksum = 0;
  for (let i = 0; i < 5000; i++) {
    const result = await source.process(request, 'webp', undefined, false);
    if (!result.cacheHit) throw Error('Cache hit expected.');
    checksum += result.data.length + result.data[0]!;
  }
  const elapsedMs = performance.now() - started,
    usage = process.cpuUsage(cpu);
  console.log(
    JSON.stringify({
      mode,
      elapsedMs,
      perOperationMs: elapsedMs / 5000,
      cpuMicrosecondsPerOperation: (usage.user + usage.system) / 5000,
      outputDigest: digest(first.data),
      outputBytes,
      checksum,
      peakRssBytes: process.resourceUsage().maxRSS * 1024,
      node: process.version,
    }),
  );
} else {
  if (mode === 'provider') {
    const { getImageProps } = (await import(
      pathToFileURL(join(root, 'dist/props.js')).href
    )) as typeof import('../../packages/svelte-imageway/src/lib/props.js');
    const { local } = (await import(
      pathToFileURL(join(root, 'dist/providers/local.js')).href
    )) as typeof import('../../packages/svelte-imageway/src/lib/providers/local.js');
    const provider = local();
    const options = inputs.map((r, i) => ({
      src: `https://images.example/${i}.jpg`,
      alt: '',
      width: 640,
      height: 400,
      provider,
      formatStrategy: 'img' as const,
    }));
    batch = () => options.map(getImageProps);
  } else if (mode === 'normalize')
    batch = () => inputs.map((input) => core.normalizeRequest({ ...input, sig: undefined }));
  else {
    const queries =
      mode === 'escaped'
        ? inputs
        : inputs.map((input) => core.normalizeRequest({ ...input, sig: undefined }));
    batch = () =>
      queries.map((input, i) =>
        control
          ? canonicalControl(input, i % 2 === 0, control === 'map-fast', control === 'loop-native')
          : core.canonicalQuery(input, i % 2 === 0),
      );
    iterations = 5000;
  }
  const initializationMs = performance.now() - initialized;
  const firstStart = performance.now(),
    first = batch(),
    firstBatchMs = performance.now() - firstStart;
  for (let i = 0; i < 100; i++) batch();
  const cpu = process.cpuUsage(),
    start = performance.now();
  let checksum = 0;
  for (let i = 0; i < iterations; i++)
    for (const value of batch())
      checksum += typeof value === 'string' ? value.length : JSON.stringify(value).length;
  const elapsedMs = performance.now() - start,
    usage = process.cpuUsage(cpu);
  console.log(
    JSON.stringify({
      mode,
      control,
      initializationMs,
      firstBatchMs,
      perOperationMs: elapsedMs / (iterations * 24),
      cpuMicrosecondsPerOperation: (usage.user + usage.system) / (iterations * 24),
      outputDigest: digest(JSON.stringify(first)),
      checksum,
      peakRssBytes: process.resourceUsage().maxRSS * 1024,
      node: process.version,
    }),
  );
}

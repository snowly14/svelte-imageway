import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp, { type OutputInfo } from 'sharp';
import { digest, names, corpus } from '../photographic/common.ts';
import { createSparseColourControl } from './control.ts';
import { createPNGControl } from '../lean-preview/control.ts';
const [root, mode, variant] = process.argv.slice(2) as [string, string, string];
const sources = await Promise.all(names.map((name) => readFile(join(corpus, name))));
if (mode.startsWith('preview:')) {
  const start = performance.now();
  const { placeholder } = (await import(
    pathToFileURL(join(root, 'dist/vite/placeholder.js')).href
  )) as typeof import('../../packages/svelte-imageway/dist/vite/placeholder.js');
  const initializationMs = performance.now() - start,
    strategy = mode.slice(8) as 'color' | 'lqip' | 'thumbhash' | 'blurhash';
  const batch = async () => {
    const output = [];
    for (const source of sources) output.push(await placeholder(source, strategy));
    return JSON.stringify(output);
  };
  const firstStart = performance.now(),
    first = await batch(),
    firstBatchMs = performance.now() - firstStart;
  await batch();
  const timed = performance.now();
  let checksum = 0;
  for (let i = 0; i < 3; i++) checksum += (await batch()).length;
  console.log(
    JSON.stringify({
      perOperationMs: (performance.now() - timed) / 72,
      initializationMs,
      firstBatchMs,
      digest: digest(first),
      checksum,
      peakRssBytes: process.resourceUsage().maxRSS * 1024,
      node: process.version,
    }),
  );
} else {
  const inputs: Array<{ data: Buffer; info: OutputInfo }> = [];
  for (const source of sources)
    inputs.push(
      await sharp(source)
        .autoOrient()
        .resize({ width: 32, height: 32, fit: 'inside', withoutEnlargement: true })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true }),
    );
  const start = performance.now();
  let run: (data: Uint8Array, w: number, h: number, i: number) => string | undefined;
  if (mode === 'colour' && variant === 'js') run = createSparseColourControl();
  else if (mode === 'png' && variant === 'js') {
    const png = createPNGControl();
    run = (data, w, h) => png(w, h, data);
  } else if (mode === 'png') {
    const {
      instance: { exports },
    } = await WebAssembly.instantiate(await readFile(join(root, 'dist/node/blurhash.wasm')));
    const k = exports as unknown as {
      memory: WebAssembly.Memory;
      pixels_ptr(): number;
      png_ptr(): number;
      rgba_png(w: number, h: number): number;
    };
    const pixels = new Uint8Array(k.memory.buffer, k.pixels_ptr(), 4096),
      png = new Uint8Array(k.memory.buffer, k.png_ptr(), 4400);
    run = (data, w, h) => {
      if (
        !Number.isSafeInteger(w) ||
        !Number.isSafeInteger(h) ||
        w < 1 ||
        h < 1 ||
        w > 32 ||
        h > 32 ||
        data.length !== w * h * 4
      )
        throw Error('Invalid bounded RGBA');
      pixels.set(data);
      const length = k.rgba_png(w, h);
      if (length < 1 || length > 4400) throw Error('Invalid bounded PNG');
      return (
        'data:image/png;base64,' +
        Buffer.from(png.buffer, png.byteOffset, length).toString('base64')
      );
    };
  } else {
    const { getBlurhashEncoder } = (await import(
      pathToFileURL(join(root, 'dist/node/blurhash.js')).href
    )) as typeof import('../../packages/svelte-imageway/dist/node/blurhash.js');
    const encoder = await getBlurhashEncoder();
    if (mode === 'colour') run = encoder.dominantColor;
    else {
      const hashes = inputs.map(({ data, info }) =>
        encoder.thumbHash(data, info.width, info.height),
      );
      run = (_data, _w, _h, i) => encoder.thumbHashDataURL(hashes[i]!);
    }
  }
  const initializationMs = performance.now() - start;
  const batch = () => inputs.map(({ data, info }, i) => run(data, info.width, info.height, i));
  const firstStart = performance.now(),
    first = batch(),
    firstBatchMs = performance.now() - firstStart;
  for (let i = 0; i < 100; i++) batch();
  let checksum = 0;
  const loops = mode === 'colour' ? 2000 : 500,
    cpu = process.cpuUsage(),
    timed = performance.now();
  for (let i = 0; i < loops; i++) for (const value of batch()) checksum += String(value).length;
  const elapsedMs = performance.now() - timed,
    usage = process.cpuUsage(cpu);
  console.log(
    JSON.stringify({
      perOperationMs: elapsedMs / (loops * 24),
      cpuMicrosecondsPerOperation: (usage.user + usage.system) / (loops * 24),
      initializationMs,
      firstBatchMs,
      digest: digest(JSON.stringify(first)),
      checksum,
      peakRssBytes: process.resourceUsage().maxRSS * 1024,
      node: process.version,
    }),
  );
}

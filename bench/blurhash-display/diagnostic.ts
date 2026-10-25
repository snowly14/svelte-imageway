import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import sharp from 'sharp';
import { encode } from 'blurhash';
import { execute, digest, names, corpus } from '../photographic/common.ts';
import { verifyCorpus } from '../lean-preview/corpus.ts';
import { gammaThresholds, referenceSrgb } from './control.ts';
await verifyCorpus();
const output = resolve('bench/results/blurhash-display-3.1.3');
await mkdir(output, { recursive: true });
const bytes = await readFile('packages/svelte-imageway/dist/node/blurhash.wasm');
const { instance } = await WebAssembly.instantiate(bytes);
const k = instance.exports as unknown as {
  memory: WebAssembly.Memory;
  tables_ptr(): number;
  thumbhash_ptr(): number;
  blurhash_tables_ptr(): number;
  gamma_lookup_ptr(): number;
  blurhash_decode(length: number): number;
};
const tables = new Float64Array(k.memory.buffer, k.tables_ptr(), 928),
  blur = new Float64Array(k.memory.buffer, k.blurhash_tables_ptr(), 367),
  lookup = new Uint8Array(k.memory.buffer, k.gamma_lookup_ptr(), 2048),
  hash = new Uint8Array(k.memory.buffer, k.thumbhash_ptr(), 32);
for (let i = 0; i < 256; i++) {
  const v = i / 255;
  tables[i] = v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}
blur.set(gammaThresholds(), 112);
for (let i = 0; i < 4; i++)
  for (let x = 0; x < 16; x++) blur[i * 16 + x] = Math.cos((Math.PI * x * i) / 16);
for (let j = 0; j < 3; j++)
  for (let y = 0; y < 16; y++) blur[64 + j * 16 + y] = Math.cos((Math.PI * y * j) / 16);
for (let i = 0; i < 2048; i++) lookup[i] = referenceSrgb(i / 2048);
const fallback = [];
for (const name of names) {
  const { data, info } = await sharp(join(corpus, name))
    .autoOrient()
    .resize({ width: 32, height: 32, fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const value = encode(new Uint8ClampedArray(data), info.width, info.height, 4, 3);
  hash.set(Buffer.from(value));
  const count = k.blurhash_decode(28);
  if (count < 1 || count > 769) throw Error('Invalid native status.');
  fallback.push({ name, hash: value, channels: count - 1 });
}
const profiles = [];
for (const mode of ['referenceJS', 'rust']) {
  const dir = resolve('.local/rust-blurhash/profiles', mode);
  await mkdir(dir, { recursive: true });
  for (const old of await readdir(dir))
    if (old.endsWith('.cpuprofile')) {
      const { rm } = await import('node:fs/promises');
      await rm(join(dir, old));
    }
  await execute(
    'node',
    [
      '--cpu-prof',
      `--cpu-prof-dir=${dir}`,
      resolve('bench/blurhash-display/child.ts'),
      mode,
      resolve('packages/svelte-imageway'),
    ],
    { timeout: 300000, maxBuffer: 1000000 },
  );
  const name = (await readdir(dir)).find((value) => value.endsWith('.cpuprofile'));
  if (!name) throw Error('CPU profile missing.');
  const raw = await readFile(join(dir, name)),
    profile = JSON.parse(raw.toString()) as {
      nodes: Array<{ id: number; callFrame: { functionName: string; url: string } }>;
      samples: number[];
      timeDeltas: number[];
    };
  const times = new Map<number, number>();
  profile.samples.forEach((id, index) =>
    times.set(id, (times.get(id) ?? 0) + profile.timeDeltas[index]!),
  );
  profiles.push({
    mode,
    profileSha256: digest(raw),
    topSelfSamples: profile.nodes
      .map((node) => ({
        function: node.callFrame.functionName,
        module: node.callFrame.url.replaceAll(resolve('.') + '/', ''),
        sampledMs: (times.get(node.id) ?? 0) / 1000,
      }))
      .sort((a, b) => b.sampledMs - a.sampledMs)
      .slice(0, 16),
  });
}
await writeFile(
  join(output, 'diagnostics.json'),
  JSON.stringify(
    {
      protocol:
        'Untimed post-benchmark diagnostics only. Fixed-memory native export counts exact gamma fallback channels for24pinned Kodak hashes. Two fresh-Node --cpu-prof runs show main-thread self-sample estimates including setup/hash preparation; native Sharp threads are not profiled. CPU profiler overhead is excluded from every timed table. Full profiles remain ignored local artifacts identified by SHA.',
      wasmSha256: digest(bytes),
      fallbackChannels: fallback.reduce((n, row) => n + row.channels, 0),
      totalChannels: 24 * 768,
      fallback,
      profiles,
    },
    null,
    2,
  ) + '\n',
);

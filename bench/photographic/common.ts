import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { cpus, totalmem, platform, arch, release, loadavg } from 'node:os';
import sharp from 'sharp';

export const execute = promisify(execFile);
export const root = resolve('.local/photographic');
export const results = resolve('bench/results/photographic-3.0.0');
export const corpus = join(root, 'corpus');
export const names = Array.from(
  { length: 24 },
  (_, i) => `kodim${String(i + 1).padStart(2, '0')}.png`,
);
export const digest = (bytes: Uint8Array | string) =>
  createHash('sha256').update(bytes).digest('hex');
export const quantile = (values: number[], p: number) => {
  const sorted = values.toSorted((a, b) => a - b);
  if (!sorted.length) throw Error('Empty sample.');
  const index = (sorted.length - 1) * p;
  const low = Math.floor(index);
  return sorted[low]! + (sorted[Math.ceil(index)]! - sorted[low]!) * (index - low);
};
export const summary = (values: number[]) => ({
  n: values.length,
  median: quantile(values, 0.5),
  q1: quantile(values, 0.25),
  q3: quantile(values, 0.75),
  min: Math.min(...values),
  max: Math.max(...values),
});
export async function save(name: string, value: unknown) {
  await mkdir(results, { recursive: true });
  await writeFile(join(results, name + '.json'), JSON.stringify(value, null, 2) + '\n');
}
export async function prepare() {
  await mkdir(corpus, { recursive: true });
  const previous = await readFile(join(results, 'corpus.json'), 'utf8').catch(() => undefined);
  const pinned = previous ? (JSON.parse(previous) as Array<{ name: string; sha256: string }>) : [];
  const manifest = [];
  for (const name of names) {
    const url = 'https://r0k.us/graphics/kodak/kodak/' + name;
    let bytes = await readFile(join(corpus, name)).catch(() => undefined);
    if (!bytes) {
      const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw Error(`Corpus download failed: ${url} ${response.status}`);
      bytes = Buffer.from(await response.arrayBuffer());
      await writeFile(join(corpus, name), bytes);
    }
    const sha256 = digest(bytes);
    const expected = pinned.find((entry) => entry.name === name);
    if (previous && expected?.sha256 !== sha256) throw Error(`Corpus digest changed: ${name}`);
    const { width, height } = await sharp(bytes).metadata();
    if (!width || !height || ![512, 768].includes(width) || width * height !== 512 * 768)
      throw Error(`Unexpected Kodak dimensions: ${name}`);
    manifest.push({ name, url, bytes: bytes.length, width, height, sha256 });
  }
  await save('corpus', manifest);
  return manifest;
}
export async function environment() {
  const packageNames = [
    'svelte-imageway',
    'vite',
    'sharp',
    'vite-imagetools',
    '@sveltejs/enhanced-img',
    'svelte',
    '@playwright/test',
    'ssim.js',
  ];
  return {
    measuredAt: new Date().toISOString(),
    sourceCommit: (await execute('git', ['rev-parse', 'HEAD'])).stdout.trim(),
    harnessDiffSha256: digest((await execute('git', ['diff', 'HEAD'])).stdout),
    platform: platform(),
    arch: arch(),
    osRelease: release(),
    cpu: cpus()[0]?.model,
    logicalCpus: cpus().length,
    memoryBytes: totalmem(),
    loadAverage: loadavg(),
    node: (await execute('node', ['--version'])).stdout.trim(),
    bun: process.versions.bun,
    versions: Object.fromEntries(
      await Promise.all(
        packageNames.map(async (name) => [
          name,
          JSON.parse(
            await readFile(
              name === 'svelte-imageway'
                ? resolve('packages/svelte-imageway/package.json')
                : resolve('node_modules', name, 'package.json'),
              'utf8',
            ),
          ).version,
        ]),
      ),
    ),
    sharp: sharp.versions,
    limits:
      'Single uncontrolled desktop host; OS filesystem cache is not flushed. Cold means empty tool disk cache, not cold OS/page cache. No simultaneous benchmark suites. No production CDN, Next.js or serverless measurement.',
  };
}

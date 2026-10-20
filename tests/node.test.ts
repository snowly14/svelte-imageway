import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdtemp, writeFile, mkdir, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { lookup } from 'node:dns/promises';
import sharp from 'sharp';
import { defineConfig, normalizeRequest } from '../packages/svelte-imageway/src/lib/core/index.js';
import { authorizeRemote, fetchRemote, isPublicAddress, readLocal } from '../packages/svelte-imageway/src/lib/node/source.js';
import { DiskCache, MemoryCache, SingleFlight } from '../packages/svelte-imageway/src/lib/node/cache.js';
import { codecCapabilities, sniff, transform } from '../packages/svelte-imageway/src/lib/node/pipeline.js';
let directory: string;
beforeAll(async () => { directory = await mkdtemp(join(tmpdir(), 'imageway-')); });
afterAll(async () => { await rm(directory, { recursive: true, force: true }); });
const config = defineConfig({ allowedOrigins: ['https://images.example', 'https://169.254.169.254', 'https://127.0.0.1'] });
const dns = (addresses: string[]) => vi.fn(async () => addresses.map(address => ({ address, family: address.includes(':') ? 6 : 4 }))) as unknown as typeof lookup;
describe('source acquisition security', () => {
  it.each(['127.0.0.1', '10.0.0.1', '172.16.0.1', '192.168.1.1', '169.254.169.254', '0.0.0.0', '100.64.1.1', '224.1.2.3', '::1', '::', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1', '2001:db8::1', 'not-an-ip'])('rejects private/reserved IP %s', ip => expect(isPublicAddress(ip)).toBe(false));
  it('accepts routable addresses and pins the vetted result', async () => {
    expect(isPublicAddress('8.8.8.8')).toBe(true); expect(isPublicAddress('2606:4700:4700::1111')).toBe(true);
    const resolveDns = dns(['8.8.8.8']);
    const pinned = await authorizeRemote('https://images.example/a', config, resolveDns);
    expect(pinned.address).toBe('8.8.8.8'); expect(resolveDns).toHaveBeenCalledTimes(1);
  });
  it('rejects rebinding and metadata even on allowed hostnames', async () => {
    await expect(authorizeRemote('https://images.example/a', config, dns(['8.8.8.8', '127.0.0.1']))).rejects.toThrow(/prohibited/);
    await expect(authorizeRemote('https://169.254.169.254/latest', config)).rejects.toThrow(/prohibited/);
    await expect(authorizeRemote('https://127.1/a', config)).rejects.toThrow(/prohibited/);
    await expect(authorizeRemote('https://images.example/a', config, dns([]))).rejects.toThrow(/prohibited/);
    await expect(authorizeRemote('https://evil.example/a', config)).rejects.toThrow(/not allowed/);
    await expect(authorizeRemote('https://u:p@images.example/a', config)).rejects.toThrow(/not allowed/);
  });
  it('revalidates redirects and bounds hops, bytes and upstream statuses', async () => {
    const transport = vi.fn(async () => ({ status: 302, headers: { location: 'https://169.254.169.254/latest' }, body: Buffer.alloc(0) }));
    await expect(fetchRemote('https://images.example/a', config, { resolveDns: dns(['8.8.8.8']), transport })).rejects.toThrow(/prohibited/);
    expect(transport).toHaveBeenCalledTimes(1);
    await expect(fetchRemote('https://images.example/a', config, { resolveDns: dns(['8.8.8.8']), transport: async () => ({ status: 302, headers: { location: '/again' }, body: Buffer.alloc(0) }) })).rejects.toThrow(/redirects/);
    await expect(fetchRemote('https://images.example/a', config, { resolveDns: dns(['8.8.8.8']), transport: async () => ({ status: 500, headers: {}, body: Buffer.alloc(0) }) })).rejects.toThrow(/did not return/);
    await expect(fetchRemote('https://images.example/a', defineConfig({ ...config, maxInputBytes: 1 }), { resolveDns: dns(['8.8.8.8']), transport: async () => ({ status: 200, headers: {}, body: Buffer.alloc(2) }) })).rejects.toThrow(/byte limit/);
    expect(await fetchRemote('https://images.example/a', config, { resolveDns: dns(['8.8.8.8']), transport: async () => ({ status: 200, headers: {}, body: Buffer.from('ok') }) })).toEqual(Buffer.from('ok'));
  });
  it('bounds stalled DNS resolution with the same source deadline', async () => {
    const hanging = (() => new Promise(() => {})) as unknown as typeof lookup;
    await expect(fetchRemote('https://images.example/a', defineConfig({ ...config, timeoutMs: 10 }), { resolveDns: hanging })).rejects.toThrow(/timed out/);
  });
  it('contains local paths and symlinks and limits input', async () => {
    const root = join(directory, 'root'); await mkdir(root); await writeFile(join(root, 'a.jpg'), 'abc');
    await writeFile(join(directory, 'secret'), 'private'); await symlink(join(directory, 'secret'), join(root, 'escape'));
    expect(await readLocal('a.jpg', root)).toEqual(Buffer.from('abc'));
    await expect(readLocal('../secret', root)).rejects.toThrow(/Invalid/);
    await expect(readLocal('escape', root)).rejects.toThrow(/escapes/);
    await expect(readLocal('a.jpg', root, 1)).rejects.toThrow(/byte limit/);
  });
});
describe('bounded caches', () => {
  it('evicts LRU by bytes and never keeps mutable buffers or expired values', () => {
    let now = 0; const cache = new MemoryCache(4, () => now); const bytes = Buffer.from('aa');
    cache.set('a', bytes, 100); bytes[0] = 0; expect(cache.get('a')?.toString()).toBe('aa');
    cache.set('b', Buffer.from('bb'), 100); cache.get('a'); cache.set('c', Buffer.from('cc'), 100);
    expect(cache.get('b')).toBeUndefined(); expect(cache.bytes).toBe(4);
    cache.set('large', Buffer.alloc(10), 100); expect(cache.get('large')).toBeUndefined();
    now = 100; expect(cache.get('a')).toBeUndefined(); expect(cache.get('missing')).toBeUndefined();
  });
  it('persists atomically with TTL and byte eviction', async () => {
    const cache = new DiskCache(join(directory, 'cache'), 4);
    expect(await cache.get('missing')).toBeUndefined(); await cache.set('a', Buffer.from('aa'));
    expect(await cache.get('a')).toEqual(Buffer.from('aa')); await cache.set('b', Buffer.from('bbb'));
    expect(await cache.get('a')).toBeUndefined(); expect(await cache.get('b', 0)).toBeUndefined();
    await cache.set('big', Buffer.alloc(5)); expect(await cache.get('big')).toBeUndefined(); await cache.delete('missing');
  });
  it('deduplicates concurrent work, releases failures and caps outstanding keys', async () => {
    const flight = new SingleFlight<number>(1); let release!: (v: number) => void; const job = vi.fn(() => new Promise<number>(r => release = r));
    const first = flight.run('x', job); const second = flight.run('x', job); expect(second).toBe(first);
    expect(() => flight.run('y', job)).toThrow(/capacity/); await Promise.resolve(); release(42);
    expect(await first).toBe(42); expect(job).toHaveBeenCalledTimes(1);
    await expect(flight.run('x', async () => { throw new Error('fail'); })).rejects.toThrow('fail');
    expect(await flight.run('x', async () => 7)).toBe(7);
  });
});
describe('real Sharp pipeline', () => {
  const base = { create: { width: 800, height: 600, channels: 3 as const, background: { r: 30, g: 100, b: 180 } } };
  it.each(['jpeg', 'png', 'webp', 'avif', 'tiff', 'gif'] as const)('decodes a real %s fixture and serves correct dimensions/MIME bytes', async format => {
    const input = await sharp(base).toFormat(format).toBuffer();
    const r = await transform(input, normalizeRequest({ key: 'fixture', w: 320 }), 'webp');
    expect(sniff(r.data)).toBe('webp'); expect(r.width).toBe(320); expect(r.height).toBe(240);
    expect(r.placeholder.length).toBeLessThan(1400); expect(r.dominantColor).toMatch(/^#[a-f\d]{6}$/);
    expect((await sharp(r.data).metadata()).exif).toBeUndefined();
  });
  it('orients EXIF, strips metadata and rejects bombs/corrupt containers', async () => {
    const input = await sharp(base).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const r = await transform(input, normalizeRequest({ key: 'x', w: 320 }), 'jpeg');
    expect(r.height).toBeGreaterThan(r.width); expect((await sharp(r.data).metadata()).orientation).toBeUndefined();
    await expect(transform(input, normalizeRequest({ key: 'x' }), 'webp', defineConfig({ maxPixels: 100 }))).rejects.toThrow(/decode|pixels/);
    await expect(transform(Buffer.from([255, 216, 255, 0]), normalizeRequest({ key: 'x' }), 'webp')).rejects.toThrow(/decode/);
    await expect(transform(Buffer.from('not an image'), normalizeRequest({ key: 'x' }), 'webp')).rejects.toThrow(/signature/);
    await expect(transform(input, normalizeRequest({ key: 'x' }), 'webp', defineConfig({ maxOutputBytes: 1 }))).rejects.toThrow(/output/);
  });
  it('rasterizes approved SVG and rejects scripts, references, handlers and non-geometric SVG', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="red"/></svg>');
    const r = await transform(svg, normalizeRequest({ key: 'x' }), 'png'); expect(sniff(r.data)).toBe('png');
    for (const payload of ['<script>alert(1)</script>', '<image href="http://169.254.169.254/"/>', '<rect onload="evil()"/>', '<style>rect{fill:red}</style>', '<rect fill="url(http://evil)"/>', '<text>x</text>']) expect(() => sniff(Buffer.from(`<svg>${payload}</svg>`))).toThrow();
    await expect(transform(svg, normalizeRequest({ key: 'x' }), 'svg')).rejects.toThrow(/Raw SVG/);
  });
  it('reports the actual codec inventory', async () => { expect(await codecCapabilities()).toHaveProperty('versions.vips'); });
});
describe('multi-frame and color fidelity', () => {
  it('preserves animation explicitly and refuses lossy flattening', async () => {
    const pixels = Buffer.alloc(32 * 64 * 3);
    for (let i = 0; i < pixels.length; i += 3) pixels[i < pixels.length / 2 ? i : i + 2] = 255;
    const input = await sharp(pixels, { raw: { width: 32, height: 64, pageHeight: 32, channels: 3 } }).gif({ delay: [100, 200], loop: 3 }).toBuffer();
    expect((await sharp(input, { animated: true }).metadata()).pages).toBe(2);
    const result = await transform(input, normalizeRequest({ key: 'x', w: 320 }), 'webp');
    const meta = await sharp(result.data, { animated: true }).metadata();
    expect(meta.pages).toBe(2); expect(meta.loop).toBe(3); expect(meta.delay).toEqual([100, 200]);
    await expect(transform(input, normalizeRequest({ key: 'x' }), 'avif')).rejects.toThrow(/does not preserve/);
    const first = await transform(input, normalizeRequest({ key: 'x', animation: 'first' }), 'avif');
    expect((await sharp(first.data).metadata()).pages ?? 1).toBe(1);
  });
  it('converts CMYK, preserves alpha and can keep ICC without EXIF', async () => {
    const input = await sharp({ create: { width: 64, height: 48, channels: 3, background: 'cyan' } }).toColourspace('cmyk').withIccProfile('cmyk').jpeg().toBuffer();
    expect((await sharp(input).metadata()).space).toBe('cmyk');
    const result = await transform(input, normalizeRequest({ key: 'x', metadata: 'icc', rotate: 90, flip: 'both', blur: 1, sharpen: 1 }), 'png');
    expect((await sharp(result.data).metadata()).space).toBe('srgb');
    expect((await sharp(result.data).metadata()).exif).toBeUndefined();
    const alpha = await sharp({ create: { width: 32, height: 32, channels: 4, background: '#ff000080' } }).png().toBuffer();
    const encoded = await transform(alpha, normalizeRequest({ key: 'x', fit: 'contain', w: 320, h: 320, bg: '00000000' }), 'webp');
    expect((await sharp(encoded.data).metadata()).hasAlpha).toBe(true);
  });
});
describe('built worker_threads pipeline', () => {
  it('executes actual compiled workers, queues jobs and propagates errors', async () => {
    const url = new URL('../packages/svelte-imageway/dist/node/pool.js', import.meta.url);
    const { TransformPool } = await import(url.href) as typeof import('../packages/svelte-imageway/src/lib/node/pool.js');
    expect(() => new TransformPool(0)).toThrow(/Invalid/);
    const pool = new TransformPool(1, 1);
    const data = await sharp({ create: { width: 64, height: 32, channels: 3, background: 'blue' } }).png().toBuffer();
    const task = { data, request: normalizeRequest({ key: 'x', w: 320 }), format: 'webp' as const, config: defineConfig() };
    const first = pool.run(task); const queued = pool.run(task);
    await expect(pool.run(task)).rejects.toThrow(/capacity/);
    expect((await first).width).toBe(64); expect((await queued).height).toBe(32);
    await expect(pool.run({ ...task, data: Buffer.from('corrupt') })).rejects.toThrow(/signature/);
  });
});
describe('integrated persistent processor', () => {
  it('reuses disk output, deduplicates, and invalidates on content/quality changes', async () => {
    const url = new URL('../packages/svelte-imageway/dist/node/processor.js', import.meta.url);
    const { ImageProcessor } = await import(url.href) as typeof import('../packages/svelte-imageway/src/lib/node/processor.js');
    const path = join(directory, 'processor');
    const processor = new ImageProcessor({ directory: path, concurrency: 2 });
    const input = await sharp({ create: { width: 64, height: 32, channels: 3, background: 'blue' } }).png().toBuffer();
    const requests = Array.from({ length: 10 }, () => processor.process(input, { key: 'x', w: 320 }, 'webp'));
    const result = await Promise.all(requests); expect(result.every(v => v.data.equals(result[0]!.data))).toBe(true);
    expect(processor.metrics.transforms).toBe(1);
    const restarted = new ImageProcessor({ directory: path });
    expect((await restarted.process(input, { key: 'x', w: 320 }, 'webp')).data).toEqual(result[0]!.data);
    expect(restarted.metrics.hit).toBe(1); expect(restarted.metrics.transforms).toBe(0);
    for (let i = 0; i < 100; i++) await restarted.process(input, { key: 'x', w: 320 }, 'webp');
    expect(restarted.metrics.hit / (restarted.metrics.hit + restarted.metrics.miss)).toBeGreaterThan(0.95);
    await processor.process(input, { key: 'x', w: 320, q: 85 }, 'webp');
    const changed = await sharp(input).negate().png().toBuffer(); await processor.process(changed, { key: 'x', w: 320 }, 'webp');
    expect(processor.metrics.transforms).toBe(3);
  });
});

it('rejects XML namespace tricks, malformed documents, escaped CSS and excessive SVG depth', () => {
  for (const s of ['<svg><svg:script xmlns:svg="http://www.w3.org/2000/svg">alert(1)</svg:script></svg>', '<svg xmlns="http://www.w3.org/1999/xhtml"><path/></svg>', '<svg/><svg/>', '<svg><rect></svg>', '<svg><rect fill="u\\72l(http://metadata/)"/></svg>', '<svg><![CDATA[attack]]></svg>', '<svg><?xml-stylesheet href="http://metadata"?></svg>', '<svg>'+ '<g>'.repeat(33)+'</g>'.repeat(33)+'</svg>']) expect(()=>sniff(Buffer.from(s))).toThrow();
});

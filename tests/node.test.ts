import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdtemp, writeFile, mkdir, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { lookup } from 'node:dns/promises';
import sharp from 'sharp';
import { defineConfig, normalizeRequest } from '../packages/svelte-imageway/src/lib/core/index.js';
import {
  authorizeRemote,
  fetchRemote,
  isPublicAddress,
  readLocal,
} from '../packages/svelte-imageway/src/lib/node/source.js';
import {
  DiskCache,
  MemoryCache,
  ValueCache,
  SingleFlight,
} from '../packages/svelte-imageway/src/lib/node/cache.js';
import {
  codecCapabilities,
  sniff,
  transform,
} from '../packages/svelte-imageway/src/lib/node/pipeline.js';
let directory: string;
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'imageway-'));
});
afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
});
const config = defineConfig({
  allowedOrigins: ['https://images.example', 'https://169.254.169.254', 'https://127.0.0.1'],
});
const dns = (addresses: string[]) =>
  vi.fn(async () =>
    addresses.map((address) => ({ address, family: address.includes(':') ? 6 : 4 })),
  ) as unknown as typeof lookup;
describe('source acquisition security', () => {
  it.each([
    '127.0.0.1',
    '10.0.0.1',
    '172.16.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '0.0.0.0',
    '100.64.1.1',
    '224.1.2.3',
    '::1',
    '::',
    'fc00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
    '2001:db8::1',
    'not-an-ip',
  ])('rejects private/reserved IP %s', (ip) => expect(isPublicAddress(ip)).toBe(false));
  it('accepts routable addresses and pins the vetted result', async () => {
    expect(isPublicAddress('8.8.8.8')).toBe(true);
    expect(isPublicAddress('2606:4700:4700::1111')).toBe(true);
    const resolveDns = dns(['8.8.8.8']);
    const pinned = await authorizeRemote('https://images.example/a', config, resolveDns);
    expect(pinned.address).toBe('8.8.8.8');
    expect(resolveDns).toHaveBeenCalledTimes(1);
  });
  it('rejects rebinding and metadata even on allowed hostnames', async () => {
    await expect(
      authorizeRemote('https://images.example/a', config, dns(['8.8.8.8', '127.0.0.1'])),
    ).rejects.toThrow(/prohibited/);
    await expect(authorizeRemote('https://169.254.169.254/latest', config)).rejects.toThrow(
      /prohibited/,
    );
    await expect(authorizeRemote('https://127.1/a', config)).rejects.toThrow(/prohibited/);
    await expect(authorizeRemote('https://images.example/a', config, dns([]))).rejects.toThrow(
      /prohibited/,
    );
    await expect(authorizeRemote('https://evil.example/a', config)).rejects.toThrow(/not allowed/);
    await expect(authorizeRemote('https://u:p@images.example/a', config)).rejects.toThrow(
      /not allowed/,
    );
  });
  it('revalidates redirects and bounds hops, bytes and upstream statuses', async () => {
    const transport = vi.fn(async () => ({
      status: 302,
      headers: { location: 'https://169.254.169.254/latest' },
      body: Buffer.alloc(0),
    }));
    await expect(
      fetchRemote('https://images.example/a', config, { resolveDns: dns(['8.8.8.8']), transport }),
    ).rejects.toThrow(/prohibited/);
    expect(transport).toHaveBeenCalledTimes(1);
    await expect(
      fetchRemote('https://images.example/a', config, {
        resolveDns: dns(['8.8.8.8']),
        transport: async () => ({
          status: 302,
          headers: { location: '/again' },
          body: Buffer.alloc(0),
        }),
      }),
    ).rejects.toThrow(/redirects/);
    await expect(
      fetchRemote('https://images.example/a', config, {
        resolveDns: dns(['8.8.8.8']),
        transport: async () => ({ status: 500, headers: {}, body: Buffer.alloc(0) }),
      }),
    ).rejects.toThrow(/did not return/);
    await expect(
      fetchRemote('https://images.example/a', defineConfig({ ...config, maxInputBytes: 1 }), {
        resolveDns: dns(['8.8.8.8']),
        transport: async () => ({ status: 200, headers: {}, body: Buffer.alloc(2) }),
      }),
    ).rejects.toThrow(/byte limit/);
    expect(
      await fetchRemote('https://images.example/a', config, {
        resolveDns: dns(['8.8.8.8']),
        transport: async () => ({ status: 200, headers: {}, body: Buffer.from('ok') }),
      }),
    ).toEqual(Buffer.from('ok'));
  });
  it('bounds stalled DNS resolution with the same source deadline', async () => {
    const hanging = (() => new Promise(() => {})) as unknown as typeof lookup;
    await expect(
      fetchRemote('https://images.example/a', defineConfig({ ...config, timeoutMs: 10 }), {
        resolveDns: hanging,
      }),
    ).rejects.toThrow(/timed out/);
  });
  it('contains local paths and symlinks and limits input', async () => {
    const root = join(directory, 'root');
    await mkdir(root);
    await writeFile(join(root, 'a.jpg'), 'abc');
    await writeFile(join(directory, 'secret'), 'private');
    await symlink(join(directory, 'secret'), join(root, 'escape'));
    expect(await readLocal('a.jpg', root)).toEqual(Buffer.from('abc'));
    await expect(readLocal('../secret', root)).rejects.toThrow(/Invalid/);
    await expect(readLocal('escape', root)).rejects.toThrow(/escapes/);
    await expect(readLocal('a.jpg', root, 1)).rejects.toThrow(/byte limit/);
  });
});
describe('bounded caches', () => {
  it('bounds immutable values by bytes/count and expires them without extending their lifetime', () => {
    let now = 0;
    const cache = new ValueCache<object>(4, () => now);
    const first = Object.freeze({ id: 1 });
    cache.set('a', first, 2, 10);
    cache.set('b', Object.freeze({ id: 2 }), 2, 10);
    expect(cache.get('a')).toBe(first);
    cache.set('c', Object.freeze({ id: 3 }), 2, 10);
    expect(cache.get('b')).toBeUndefined();
    cache.set('too-large', first, 5, 10);
    expect(cache.get('too-large')).toBeUndefined();
    expect(cache.bytes).toBe(4);
    now = 10;
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('c')).toBeUndefined();
    expect(cache.bytes).toBe(0);
    for (let i = 0; i < 5000; i++) cache.set(String(i), first, 0, 10);
    expect(cache.bytes).toBe(0);
    const counted = new ValueCache<object>(10000);
    for (let i = 0; i < 5000; i++) counted.set(String(i), first, 1, 1000);
    expect(counted.bytes).toBe(4096);
    expect(counted.get('0')).toBeUndefined();
    expect(counted.get('4999')).toBe(first);
  });
  it('evicts LRU by bytes and never keeps mutable buffers or expired values', () => {
    let now = 0;
    const cache = new MemoryCache(4, () => now);
    const bytes = Buffer.from('aa');
    cache.set('a', bytes, 100);
    bytes[0] = 0;
    expect(cache.get('a')?.toString()).toBe('aa');
    cache.set('b', Buffer.from('bb'), 100);
    cache.get('a');
    cache.set('c', Buffer.from('cc'), 100);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.bytes).toBe(4);
    cache.set('large', Buffer.alloc(10), 100);
    expect(cache.get('large')).toBeUndefined();
    now = 100;
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('missing')).toBeUndefined();
  });
  it('persists atomically with TTL and byte eviction', async () => {
    const cache = new DiskCache(join(directory, 'cache'), 4);
    expect(await cache.get('missing')).toBeUndefined();
    await cache.set('a', Buffer.from('aa'));
    expect(await cache.get('a')).toEqual(Buffer.from('aa'));
    await cache.set('b', Buffer.from('bbb'));
    expect(await cache.get('a')).toBeUndefined();
    expect(await cache.get('b', 0)).toBeUndefined();
    await cache.set('big', Buffer.alloc(5));
    expect(await cache.get('big')).toBeUndefined();
    await cache.delete('missing');
  });
  it('deduplicates concurrent work, releases failures and caps outstanding keys', async () => {
    const flight = new SingleFlight<number>(1);
    let release!: (v: number) => void;
    const job = vi.fn(() => new Promise<number>((r) => (release = r)));
    const first = flight.run('x', job);
    const second = flight.run('x', job);
    expect(second).toBe(first);
    expect(() => flight.run('y', job)).toThrow(/capacity/);
    await Promise.resolve();
    release(42);
    expect(await first).toBe(42);
    expect(job).toHaveBeenCalledTimes(1);
    await expect(
      flight.run('x', async () => {
        throw new Error('fail');
      }),
    ).rejects.toThrow('fail');
    expect(await flight.run('x', async () => 7)).toBe(7);
  });
});
describe('real Sharp pipeline', () => {
  const base = {
    create: {
      width: 800,
      height: 600,
      channels: 3 as const,
      background: { r: 30, g: 100, b: 180 },
    },
  };
  it.each(['jpeg', 'png', 'webp', 'avif', 'tiff', 'gif'] as const)(
    'decodes a real %s fixture and serves correct dimensions/MIME bytes',
    async (format) => {
      const input = await sharp(base).toFormat(format).toBuffer();
      const r = await transform(input, normalizeRequest({ key: 'fixture', w: 320 }), 'webp');
      expect(sniff(r.data)).toBe('webp');
      expect(r.width).toBe(320);
      expect(r.height).toBe(240);
      expect(r.placeholder.length).toBeLessThan(1400);
      expect(r.dominantColor).toMatch(/^#[a-f\d]{6}$/);
      expect((await sharp(r.data).metadata()).exif).toBeUndefined();
    },
  );
  it.each(['jpeg', 'png', 'webp', 'avif'] as const)(
    'preserves %s encoded bytes when build previews are omitted',
    async (format) => {
      const input = await sharp(base).png().toBuffer();
      const request = normalizeRequest({ key: 'fixture', w: 320 });
      const withPreview = await transform(input, request, format, undefined, true);
      const withoutPreview = await transform(input, request, format, undefined, false);
      expect(withoutPreview.data).toEqual(withPreview.data);
      expect([withoutPreview.width, withoutPreview.height, withoutPreview.format]).toEqual([
        withPreview.width,
        withPreview.height,
        withPreview.format,
      ]);
      expect(withoutPreview.placeholder).toBe('');
      expect(withoutPreview.dominantColor).toBe('');
      expect(withPreview.placeholder).toMatch(/^data:image\/webp;base64,/);
      expect(withPreview.dominantColor).toMatch(/^#[a-f\d]{6}$/);
    },
  );
  it('enforces input, pixel and output limits when previews are omitted', async () => {
    const input = await sharp(base).png().toBuffer();
    const request = normalizeRequest({ key: 'fixture', w: 320 });
    await expect(
      transform(input, request, 'webp', defineConfig({ maxInputBytes: 1 }), false),
    ).rejects.toMatchObject({ code: 'INPUT_SIZE', status: 413 });
    await expect(
      transform(input, request, 'webp', defineConfig({ maxPixels: 100 }), false),
    ).rejects.toThrow(/decode|pixels|dimensions/);
    await expect(
      transform(input, request, 'webp', defineConfig({ maxOutputBytes: 1 }), false),
    ).rejects.toMatchObject({ code: 'OUTPUT_SIZE', status: 413 });
  });
  it('orients EXIF, strips metadata and rejects bombs/corrupt containers', async () => {
    const input = await sharp(base).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const r = await transform(input, normalizeRequest({ key: 'x', w: 320 }), 'jpeg');
    expect(r.height).toBeGreaterThan(r.width);
    expect((await sharp(r.data).metadata()).orientation).toBeUndefined();
    await expect(
      transform(input, normalizeRequest({ key: 'x' }), 'webp', defineConfig({ maxPixels: 100 })),
    ).rejects.toThrow(/decode|pixels|dimensions/);
    await expect(
      transform(Buffer.from([255, 216, 255, 0]), normalizeRequest({ key: 'x' }), 'webp'),
    ).rejects.toThrow(/decode/);
    await expect(
      transform(Buffer.from('not an image'), normalizeRequest({ key: 'x' }), 'webp'),
    ).rejects.toThrow(/signature/);
    await expect(
      transform(input, normalizeRequest({ key: 'x' }), 'webp', defineConfig({ maxOutputBytes: 1 })),
    ).rejects.toThrow(/output/);
  });
  it('rasterizes approved SVG and rejects scripts, references, handlers and non-geometric SVG', async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="red"/></svg>',
    );
    const r = await transform(svg, normalizeRequest({ key: 'x' }), 'png');
    expect(sniff(r.data)).toBe('png');
    const withoutPreview = await transform(
      svg,
      normalizeRequest({ key: 'x' }),
      'png',
      undefined,
      false,
    );
    expect(withoutPreview.data).toEqual(r.data);
    for (const payload of [
      '<script>alert(1)</script>',
      '<image href="http://169.254.169.254/"/>',
      '<rect onload="evil()"/>',
      '<style>rect{fill:red}</style>',
      '<rect fill="url(http://evil)"/>',
      '<text>x</text>',
    ])
      expect(() => sniff(Buffer.from(`<svg>${payload}</svg>`))).toThrow();
    await expect(transform(svg, normalizeRequest({ key: 'x' }), 'svg')).rejects.toThrow(/Raw SVG/);
  });
  it('reports the actual codec inventory', async () => {
    expect(await codecCapabilities()).toHaveProperty('versions.vips');
  });
  it('recognizes JPEG XL signatures and gives a codec error when the installed decoder is absent', async () => {
    const codestream = Buffer.from([0xff, 0x0a, 0, 0]);
    const container = Buffer.from('0000000c4a584c200d0a870a', 'hex');
    expect(sniff(codestream)).toBe('jxl');
    expect(sniff(container)).toBe('jxl');
    const report = await codecCapabilities();
    expect(typeof report.formats.jxl.input.buffer).toBe('boolean');
    if (!report.formats.jxl.input.buffer) {
      await expect(
        transform(codestream, normalizeRequest({ key: 'jxl' }), 'webp'),
      ).rejects.toMatchObject({ code: 'CODEC_UNAVAILABLE', status: 415 });
    }
  });
});
describe('multi-frame and color fidelity', () => {
  it('preserves animation explicitly and refuses lossy flattening', async () => {
    const pixels = Buffer.alloc(32 * 64 * 3);
    for (let i = 0; i < pixels.length; i += 3) pixels[i < pixels.length / 2 ? i : i + 2] = 255;
    const input = await sharp(pixels, {
      raw: { width: 32, height: 64, pageHeight: 32, channels: 3 },
    })
      .gif({ delay: [100, 200], loop: 3 })
      .toBuffer();
    expect((await sharp(input, { animated: true }).metadata()).pages).toBe(2);
    const result = await transform(input, normalizeRequest({ key: 'x', w: 320 }), 'webp');
    const withoutPreview = await transform(
      input,
      normalizeRequest({ key: 'x', w: 320 }),
      'webp',
      undefined,
      false,
    );
    expect(withoutPreview.data).toEqual(result.data);
    const meta = await sharp(result.data, { animated: true }).metadata();
    expect(meta.pages).toBe(2);
    expect(meta.loop).toBe(3);
    expect(meta.delay).toEqual([100, 200]);
    const gif = await transform(input, normalizeRequest({ key: 'x', w: 320 }), 'gif');
    const gifWithoutPreview = await transform(
      input,
      normalizeRequest({ key: 'x', w: 320 }),
      'gif',
      undefined,
      false,
    );
    expect(gifWithoutPreview.data).toEqual(gif.data);
    expect((await sharp(gifWithoutPreview.data, { animated: true }).metadata()).pages).toBe(2);
    await expect(transform(input, normalizeRequest({ key: 'x' }), 'avif')).rejects.toThrow(
      /does not preserve/,
    );
    const first = await transform(
      input,
      normalizeRequest({ key: 'x', animation: 'first' }),
      'avif',
    );
    expect((await sharp(first.data).metadata()).pages ?? 1).toBe(1);
    const firstWithoutPreview = await transform(
      input,
      normalizeRequest({ key: 'x', animation: 'first' }),
      'avif',
      undefined,
      false,
    );
    expect(firstWithoutPreview.data).toEqual(first.data);
  });
  it('converts CMYK, preserves alpha and can keep ICC without EXIF', async () => {
    const input = await sharp({
      create: { width: 64, height: 48, channels: 3, background: 'cyan' },
    })
      .toColourspace('cmyk')
      .withIccProfile('cmyk')
      .jpeg()
      .toBuffer();
    expect((await sharp(input).metadata()).space).toBe('cmyk');
    const result = await transform(
      input,
      normalizeRequest({
        key: 'x',
        metadata: 'icc',
        rotate: 90,
        flip: 'both',
        blur: 1,
        sharpen: 1,
      }),
      'png',
    );
    const noPreview = await transform(
      input,
      normalizeRequest({
        key: 'x',
        metadata: 'icc',
        rotate: 90,
        flip: 'both',
        blur: 1,
        sharpen: 1,
      }),
      'png',
      undefined,
      false,
    );
    expect(noPreview.data).toEqual(result.data);
    expect((await sharp(result.data).metadata()).space).toBe('srgb');
    expect((await sharp(result.data).metadata()).exif).toBeUndefined();
    const alpha = await sharp({
      create: { width: 32, height: 32, channels: 4, background: '#ff000080' },
    })
      .png()
      .toBuffer();
    const encoded = await transform(
      alpha,
      normalizeRequest({ key: 'x', fit: 'contain', w: 320, h: 320, bg: '00000000' }),
      'webp',
    );
    const alphaWithoutPreview = await transform(
      alpha,
      normalizeRequest({ key: 'x', fit: 'contain', w: 320, h: 320, bg: '00000000' }),
      'webp',
      undefined,
      false,
    );
    expect(alphaWithoutPreview.data).toEqual(encoded.data);
    expect((await sharp(encoded.data).metadata()).hasAlpha).toBe(true);
  });
});
describe('built worker_threads pipeline', () => {
  it('schedules a finite build batch outside the runtime queue without loosening admission', async () => {
    const { TransformPool } = (await import(
      new URL('../packages/svelte-imageway/dist/node/pool.js', import.meta.url).href
    )) as typeof import('../packages/svelte-imageway/src/lib/node/pool.js');
    const pool = new TransformPool(1, 0, 1);
    const data = await sharp({ create: { width: 64, height: 32, channels: 3, background: 'blue' } })
      .png()
      .toBuffer();
    const task = {
      data,
      request: normalizeRequest({ key: 'x', w: 320 }),
      format: 'webp' as const,
      config: defineConfig(),
      preview: false,
    };
    const batch = Promise.all(Array.from({ length: 70 }, () => pool.runBuild(task)));
    // Request admission remains closed while the first build transform occupies the worker.
    await expect(pool.run(task)).rejects.toThrow(/capacity/);
    const results = await batch;
    expect(results).toHaveLength(70);
    for (const result of results) expect(result.width).toBe(64);
    await expect(pool.runBuild({ ...task, data: Buffer.from('corrupt') })).rejects.toThrow(
      /signature/,
    );
    expect((await pool.runBuild(task)).height).toBe(32);
  });
  it('sniffs only the declared bytes of an offset input view', () => {
    const container = Buffer.from([0, 0, 0xff, 0xd8, 0xff, 0]);
    expect(sniff(new Uint8Array(container.buffer, container.byteOffset + 2, 3))).toBe('jpeg');
    expect(() => sniff(new Uint8Array(container.buffer, container.byteOffset, 2))).toThrow(
      /signature/,
    );
  });
  it('executes actual compiled workers, queues jobs and propagates errors', async () => {
    const url = new URL('../packages/svelte-imageway/dist/node/pool.js', import.meta.url);
    const { TransformPool } = (await import(
      url.href
    )) as typeof import('../packages/svelte-imageway/src/lib/node/pool.js');
    expect(() => new TransformPool(0)).toThrow(/Invalid/);
    const pool = new TransformPool(1, 1);
    const data = await sharp({ create: { width: 64, height: 32, channels: 3, background: 'blue' } })
      .png()
      .toBuffer();
    const task = {
      data,
      request: normalizeRequest({ key: 'x', w: 320 }),
      format: 'webp' as const,
      config: defineConfig(),
    };
    const first = pool.run(task);
    const queued = pool.run(task);
    await expect(pool.run(task)).rejects.toThrow(/capacity/);
    expect((await first).width).toBe(64);
    expect((await queued).height).toBe(32);
    await expect(pool.run({ ...task, data: Buffer.from('corrupt') })).rejects.toThrow(/signature/);
    // A failed decode must not poison the retained worker or leak its admission slot.
    const recovered = await pool.run({ ...task, preview: false });
    expect(recovered.width).toBe(64);
    expect(recovered.placeholder).toBe('');
    const byteBound = new TransformPool(1, 4, data.length - 1);
    const active = byteBound.run(task);
    await expect(byteBound.run(task)).rejects.toThrow(/capacity/);
    await active;
  });
});
describe('integrated persistent processor', () => {
  it('shares one owned exact-size build snapshot across worker variants without exposing caller bytes', async () => {
    const { ImageProcessor } = (await import(
      new URL('../packages/svelte-imageway/dist/node/processor.js', import.meta.url).href
    )) as typeof import('../packages/svelte-imageway/src/lib/node/processor.js');
    const { TransformPool } = (await import(
      new URL('../packages/svelte-imageway/dist/node/pool.js', import.meta.url).href
    )) as typeof import('../packages/svelte-imageway/src/lib/node/pool.js');
    const config = defineConfig({ widths: [32, 48, 64] });
    const input = await sharp({
      create: { width: 80, height: 40, channels: 3, background: 'orange' },
    })
      .png()
      .toBuffer();
    const bounded = new ImageProcessor({
      directory: join(directory, 'bounded-build'),
      build: true,
      config: defineConfig({ maxInputBytes: 1 }),
    });
    expect(() => bounded.prepare(input)).toThrow(/byte limit/);
    const container = new Uint8Array(input.length + 4096);
    container.set(input, 2048);
    const view = container.subarray(2048, 2048 + input.length);
    const processor = new ImageProcessor({
      directory: join(directory, 'shared-build'),
      config,
      build: true,
      concurrency: 2,
    });
    const prepared = processor.prepare(view);
    container.fill(0);
    const spy = vi.spyOn(TransformPool.prototype, 'runBuild');
    try {
      const outputs = await Promise.all(
        config.widths.map((w) => prepared.process({ key: 'x', w }, 'webp', undefined, false)),
      );
      const submitted = spy.mock.calls.map(([task]) => task.data);
      expect(submitted).toHaveLength(3);
      for (const data of submitted) {
        expect(data.buffer).toBeInstanceOf(SharedArrayBuffer);
        expect(data.buffer).toBe(submitted[0]!.buffer);
        expect(data.buffer.byteLength).toBe(input.length);
        expect(Buffer.from(data)).toEqual(input);
      }
      for (const [i, w] of config.widths.entries()) {
        const reference = await transform(
          input,
          normalizeRequest({ key: 'x', w }, config),
          'webp',
          config,
          false,
        );
        expect(outputs[i]!.data).toEqual(reference.data);
      }
      outputs[0]!.data.fill(0);
      expect((await prepared.process({ key: 'x', w: 32 }, 'webp', undefined, false)).data).toEqual(
        (
          await transform(
            input,
            normalizeRequest({ key: 'x', w: 32 }, config),
            'webp',
            config,
            false,
          )
        ).data,
      );
      const invalid = processor.prepare(Buffer.from('bad'));
      await expect(invalid.process({ key: 'x', w: 32 }, 'webp', undefined, false)).rejects.toThrow(
        /signature/,
      );
      expect(
        (await prepared.process({ key: 'x', w: 48, q: 85 }, 'webp', undefined, false)).width,
      ).toBe(48);
    } finally {
      spy.mockRestore();
    }
  });
  it('keeps runtime prepared inputs on private ordinary storage even when the caller uses shared memory', async () => {
    const { ImageProcessor } = (await import(
      new URL('../packages/svelte-imageway/dist/node/processor.js', import.meta.url).href
    )) as typeof import('../packages/svelte-imageway/src/lib/node/processor.js');
    const { TransformPool } = (await import(
      new URL('../packages/svelte-imageway/dist/node/pool.js', import.meta.url).href
    )) as typeof import('../packages/svelte-imageway/src/lib/node/pool.js');
    const input = await sharp({
      create: { width: 32, height: 16, channels: 3, background: 'blue' },
    })
      .png()
      .toBuffer();
    const caller = new Uint8Array(new SharedArrayBuffer(input.length));
    caller.set(input);
    const processor = new ImageProcessor({
      directory: join(directory, 'runtime-copy'),
      concurrency: 1,
    });
    const prepared = processor.prepare(caller);
    caller.fill(0);
    const spy = vi.spyOn(TransformPool.prototype, 'run');
    try {
      expect((await prepared.process({ key: 'x' }, 'webp', undefined, false)).width).toBe(32);
      expect(spy.mock.calls[0]![0].data.buffer).toBeInstanceOf(ArrayBuffer);
      expect(Buffer.from(spy.mock.calls[0]![0].data)).toEqual(input);
    } finally {
      spy.mockRestore();
    }
  });
  it('owns the processing policy before memoizing its cache identity', async () => {
    const { ImageProcessor } = (await import(
      new URL('../packages/svelte-imageway/dist/node/processor.js', import.meta.url).href
    )) as typeof import('../packages/svelte-imageway/src/lib/node/processor.js');
    const config = { ...defineConfig(), qualities: [50, 65, 75, 85, 95] };
    const processor = new ImageProcessor({ directory: join(directory, 'owned-policy'), config });
    const input = await sharp({ create: { width: 32, height: 16, channels: 3, background: 'red' } })
      .png()
      .toBuffer();
    const prepared = processor.prepare(input);
    const a = await prepared.process({ key: 'x', q: 75 }, 'webp', undefined, false);
    config.qualities.splice(0);
    const b = await prepared.process({ key: 'x', q: 75 }, 'webp', undefined, false);
    expect(b.cacheHit).toBe(true);
    expect(b.data).toEqual(a.data);
    expect(processor.metrics.transforms).toBe(1);
  });
  it('keeps disk/memory output copies isolated and respects a cache budget too small for retention', async () => {
    const { ImageProcessor } = (await import(
      new URL('../packages/svelte-imageway/dist/node/processor.js', import.meta.url).href
    )) as typeof import('../packages/svelte-imageway/src/lib/node/processor.js');
    const path = join(directory, 'output-copies');
    const processor = new ImageProcessor({ directory: path, memoryBytes: 1 });
    const input = await sharp({
      create: { width: 32, height: 16, channels: 3, background: 'blue' },
    })
      .png()
      .toBuffer();
    const prepared = processor.prepare(input);
    const a = await prepared.process({ key: 'x' }, 'webp', undefined, false);
    const expected = Buffer.from(a.data);
    a.data.fill(0);
    const b = await prepared.process({ key: 'x' }, 'webp', undefined, false);
    expect(b.cacheHit).toBe(true);
    expect(b.data).toEqual(expected);
    b.data.fill(1);
    expect((await prepared.process({ key: 'x' }, 'webp', undefined, false)).data).toEqual(expected);
    const restarted = new ImageProcessor({ directory: path });
    const disk = await restarted.process(input, { key: 'x' }, 'webp', undefined, false);
    expect(disk.cacheHit).toBe(true);
    disk.data.fill(2);
    expect((await restarted.process(input, { key: 'x' }, 'webp', undefined, false)).data).toEqual(
      expected,
    );
    expect(processor.metrics.transforms).toBe(1);
  });
  it('owns prepared input snapshots and keeps cached outputs isolated from caller mutation', async () => {
    const { ImageProcessor } = (await import(
      new URL('../packages/svelte-imageway/dist/node/processor.js', import.meta.url).href
    )) as typeof import('../packages/svelte-imageway/src/lib/node/processor.js');
    const processor = new ImageProcessor({ directory: join(directory, 'prepared') });
    const bytes = await sharp({ create: { width: 80, height: 40, channels: 3, background: 'red' } })
      .png()
      .toBuffer();
    const original = Buffer.from(bytes);
    const prepared = processor.prepare(bytes);
    expect(Object.isFrozen(prepared)).toBe(true);
    bytes.fill(0);
    const request = { key: 'prepared', w: 320 };
    const first = await prepared.process(request, 'webp', undefined, false);
    const expected = await processor.process(original, request, 'webp', undefined, false);
    expect(first.data).toEqual(expected.data);
    first.data.fill(0);
    expect((await prepared.process(request, 'webp', undefined, false)).data).toEqual(expected.data);
    expect(processor.metrics.transforms).toBe(1);
    expect(() => processor.prepare(new Uint8Array())).toThrow(/byte limit/);
    const limited = new ImageProcessor({
      directory: join(directory, 'limited-prepared'),
      config: defineConfig({ maxInputBytes: 1 }),
    });
    expect(() => limited.prepare(original)).toThrow(/byte limit/);
    const invalid = processor.prepare(Buffer.from('bad'));
    await expect(invalid.process(request, 'webp')).rejects.toThrow(/signature/);
  });
  it('reuses disk output, deduplicates, and invalidates on content/quality changes', async () => {
    const url = new URL('../packages/svelte-imageway/dist/node/processor.js', import.meta.url);
    const { ImageProcessor } = (await import(
      url.href
    )) as typeof import('../packages/svelte-imageway/src/lib/node/processor.js');
    const path = join(directory, 'processor');
    const processor = new ImageProcessor({ directory: path, concurrency: 2 });
    const input = await sharp({
      create: { width: 64, height: 32, channels: 3, background: 'blue' },
    })
      .png()
      .toBuffer();
    const requests = Array.from({ length: 10 }, () =>
      processor.process(input, { key: 'x', w: 320 }, 'webp'),
    );
    const result = await Promise.all(requests);
    expect(result.every((v) => v.data.equals(result[0]!.data))).toBe(true);
    expect(processor.metrics.transforms).toBe(1);
    const restarted = new ImageProcessor({ directory: path });
    expect((await restarted.process(input, { key: 'x', w: 320 }, 'webp')).data).toEqual(
      result[0]!.data,
    );
    expect(restarted.metrics.hit).toBe(1);
    expect(restarted.metrics.transforms).toBe(0);
    for (let i = 0; i < 100; i++) await restarted.process(input, { key: 'x', w: 320 }, 'webp');
    expect(
      restarted.metrics.hit / (restarted.metrics.hit + restarted.metrics.miss),
    ).toBeGreaterThan(0.95);
    await processor.process(input, { key: 'x', w: 320, q: 85 }, 'webp');
    const changed = await sharp(input).negate().png().toBuffer();
    await processor.process(changed, { key: 'x', w: 320 }, 'webp');
    expect(processor.metrics.transforms).toBe(3);
  });
  it('does not reuse an existing cache entry under stricter pixel or output limits', async () => {
    const { ImageProcessor } = (await import(
      new URL('../packages/svelte-imageway/dist/node/processor.js', import.meta.url).href
    )) as typeof import('../packages/svelte-imageway/src/lib/node/processor.js');
    const path = join(directory, 'security-policy-cache');
    const input = await sharp({
      create: { width: 64, height: 64, channels: 3, background: 'blue' },
    })
      .png()
      .toBuffer();
    const request = { key: 'security-policy', w: 320 };
    const original = new ImageProcessor({ directory: path });
    expect((await original.process(input, request, 'webp', undefined, false)).cacheHit).toBe(false);
    const pixels = new ImageProcessor({
      directory: path,
      config: defineConfig({ maxPixels: 100 }),
    });
    await expect(pixels.process(input, request, 'webp', undefined, false)).rejects.toThrow(
      /decode|pixels|dimensions/,
    );
    expect(pixels.metrics.hit).toBe(0);
    const output = new ImageProcessor({
      directory: path,
      config: defineConfig({ maxOutputBytes: 1 }),
    });
    await expect(output.process(input, request, 'webp', undefined, false)).rejects.toMatchObject({
      code: 'OUTPUT_SIZE',
      status: 413,
    });
    expect(output.metrics.hit).toBe(0);
  });
});

it('rejects XML namespace tricks, malformed documents, escaped CSS and excessive SVG depth', () => {
  for (const s of [
    '<svg><svg:script xmlns:svg="http://www.w3.org/2000/svg">alert(1)</svg:script></svg>',
    '<svg xmlns="http://www.w3.org/1999/xhtml"><path/></svg>',
    '<svg/><svg/>',
    '<svg><rect></svg>',
    '<svg><rect fill="u\\72l(http://metadata/)"/></svg>',
    '<svg><![CDATA[attack]]></svg>',
    '<svg><?xml-stylesheet href="http://metadata"?></svg>',
    '<svg>' + '<g>'.repeat(33) + '</g>'.repeat(33) + '</svg>',
  ])
    expect(() => sniff(Buffer.from(s))).toThrow();
});

it('does not retain empty sources and bounds tiny cache entries by count', () => {
  const cache = new MemoryCache(1_000_000);
  for (let i = 0; i < 10_000; i++) cache.set(String(i), Buffer.alloc(0), 1000);
  expect(cache.get('9999')).toBeUndefined();
  for (let i = 0; i < 5000; i++) cache.set(String(i), Buffer.alloc(1), 1000);
  expect(cache.bytes).toBe(4096);
  expect(cache.get('0')).toBeUndefined();
  expect(cache.get('4999')).toBeDefined();
});
it('shares disk accounting across writers and reconciles external files', async () => {
  const path = join(directory, 'shared-disk');
  const first = new DiskCache(path, 10);
  const second = new DiskCache(path, 10);
  await Promise.all(
    Array.from({ length: 20 }, (_, i) => (i % 2 ? first : second).set(String(i), Buffer.alloc(2))),
  );
  const fs = await import('node:fs/promises');
  expect((await fs.readdir(path)).length).toBe(5);
  expect(await first.get('0')).toBeUndefined();
  expect(await second.get('19')).toHaveLength(2);
  for (let i = 0; i < 10; i++) await new DiskCache(path, 10).set('same', Buffer.alloc(2));
  const { hash } = await import('../packages/svelte-imageway/src/lib/node/cache.js');
  await fs.writeFile(join(path, hash('external')), Buffer.alloc(12));
  const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 31_000);
  try {
    await second.set('after-external', Buffer.alloc(2));
    const sizes = await Promise.all(
      (await fs.readdir(path)).map(async (name) => (await fs.stat(join(path, name))).size),
    );
    expect(sizes.reduce((total, size) => total + size, 0)).toBeLessThanOrEqual(10);
  } finally {
    clock.mockRestore();
  }
});
it('does not reuse representations under a stricter output policy', async () => {
  const url = new URL('../packages/svelte-imageway/dist/node/processor.js', import.meta.url);
  const { ImageProcessor } = (await import(
    url.href
  )) as typeof import('../packages/svelte-imageway/src/lib/node/processor.js');
  const path = join(directory, 'policy-cache');
  const input = await sharp({ create: { width: 64, height: 32, channels: 3, background: 'blue' } })
    .png()
    .toBuffer();
  const request = { key: 'policy.png', w: 320 };
  await new ImageProcessor({ directory: path }).process(input, request, 'webp', undefined, false);
  const strict = new ImageProcessor({
    directory: path,
    config: defineConfig({ maxOutputBytes: 1 }),
  });
  await expect(strict.process(input, request, 'webp', undefined, false)).rejects.toThrow(
    /byte limit/,
  );
});

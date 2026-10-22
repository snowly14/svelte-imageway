import { mkdtemp, readdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PreviewCache } from '../packages/svelte-imageway/src/lib/vite/preview-cache.js';
import { defineConfig } from '../packages/svelte-imageway/src/lib/core/config.js';

const directories: string[] = [];
async function directory() {
  const path = await mkdtemp(join(tmpdir(), 'imageway-preview-'));
  directories.push(path);
  return path;
}
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});
describe('persistent build preview cache', () => {
  it('reuses immutable metadata across plugin instances without another decode', async () => {
    const path = await directory();
    const generate = vi.fn(async () => ({
      dominantColor: '#123456',
      placeholder: 'data:image/webp;base64,YQ==',
    }));
    const first = await new PreviewCache(path).resolve(
      'source',
      'lqip',
      defineConfig(),
      { vips: '1' },
      generate,
    );
    const next = new PreviewCache(path);
    expect(await next.resolve('source', 'lqip', defineConfig(), { vips: '1' }, generate)).toEqual(
      first,
    );
    expect(Object.isFrozen(first)).toBe(true);
    await next.resolve('source', 'lqip', defineConfig(), { vips: '1' }, generate);
    expect(generate).toHaveBeenCalledTimes(1);
  });
  it('invalidates on content, preview strategy, codec and security policy changes', async () => {
    const path = await directory();
    const cache = new PreviewCache(path);
    const generate = vi.fn(async () => ({ dominantColor: '#123456' }));
    await cache.resolve('a', 'color', defineConfig(), { vips: '1' }, generate);
    await cache.resolve('b', 'color', defineConfig(), { vips: '1' }, generate);
    await cache.resolve('a', 'color', defineConfig({ maxPixels: 1 }), { vips: '1' }, generate);
    await cache.resolve('a', 'color', defineConfig(), { vips: '2' }, generate);
    await cache.resolve('a', 'lqip', defineConfig(), { vips: '1' }, generate);
    expect(generate).toHaveBeenCalledTimes(5);
  });
  it.each([
    '{broken',
    '{"dominantColor":"red"}',
    '{"dominantColor":"#123456","extra":1}',
    'x'.repeat(32_769),
  ])('recomputes corrupt or oversized metadata', async (data) => {
    const path = await directory();
    const generate = vi.fn(async () => ({ dominantColor: '#123456' }));
    await new PreviewCache(path).resolve('a', 'color', defineConfig(), {}, generate);
    await writeFile(join(path, (await readdir(path))[0]!), data);
    expect(
      await new PreviewCache(path).resolve('a', 'color', defineConfig(), {}, generate),
    ).toEqual({ dominantColor: '#123456' });
    expect(generate).toHaveBeenCalledTimes(2);
  });
  it('none performs no cache IO or preview generation', async () => {
    const path = join(await directory(), 'absent');
    const generate = vi.fn(async () => ({}));
    expect(await new PreviewCache(path).resolve('a', 'none', defineConfig(), {}, generate)).toEqual(
      {},
    );
    expect(generate).not.toHaveBeenCalled();
    await expect(readdir(path)).rejects.toThrow();
  });
});

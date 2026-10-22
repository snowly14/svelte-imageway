import { it, expect, vi } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hash } from '../packages/svelte-imageway/src/lib/node/cache.js';
import {
  publishAssets,
  collectGarbage,
  type StorageTarget,
} from '../packages/svelte-imageway/src/lib/publish/index.js';
const bytes = new TextEncoder().encode('fixture');
const key = `imageway/${hash(bytes)}.webp`;
const input = [{ key, bytes, contentType: 'image/webp' }];
function target() {
  const data = new Map<string, { size: number; hash: string }>();
  const put = vi.fn(
    async (key: string, bytes: Uint8Array, m: { hash: string; cacheControl: string }) => {
      expect(m.cacheControl).toContain('immutable');
      data.set(key, { size: bytes.length, hash: m.hash });
    },
  );
  const storage: StorageTarget = {
    id: 'test:bucket',
    head: async (key) => data.get(key),
    put,
    delete: vi.fn(async (key) => {
      data.delete(key);
    }),
  };
  return { storage, data, put };
}
it('publishes a versioned manifest, resumes remotely, and performs no I/O in dry-run', async () => {
  const root = await mkdtemp(join(tmpdir(), 'imageway-publish-'));
  const t = target();
  const options = {
    target: t.storage,
    publicBase: 'https://cdn.example/assets',
    manifestPath: join(root, 'manifest.json'),
  };
  try {
    const dry = await publishAssets(input, { ...options, dryRun: true });
    expect(dry.planned).toBe(1);
    expect(t.put).not.toHaveBeenCalled();
    await expect(readFile(options.manifestPath)).rejects.toThrow();
    const a = await publishAssets([...input, ...input], options);
    expect(a.uploaded).toBe(1);
    expect(JSON.parse(await readFile(options.manifestPath, 'utf8')).version).toBe(1);
    expect(a.manifest.entries[0]?.url).toBe('https://cdn.example/assets/' + key);
    const b = await publishAssets(input, options);
    expect(b.skipped).toBe(1);
    expect(t.put).toHaveBeenCalledTimes(1);
    t.data.set(key, { size: 1, hash: 'wrong' });
    expect((await publishAssets(input, options)).uploaded).toBe(1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
it('retries transient uploads, fails closed on permissions and refuses arbitrary keys', async () => {
  const t = target();
  let n = 0;
  t.storage.put = async () => {
    if (++n < 3) throw Object.assign(new Error('Temporary'), { status: 503 });
  };
  await publishAssets(input, { target: t.storage, publicBase: 'https://cdn.example' });
  expect(n).toBe(3);
  n = 0;
  t.storage.put = async () => {
    n++;
    throw Object.assign(new Error('Denied'), { status: 403 });
  };
  await expect(
    publishAssets(input, { target: t.storage, publicBase: 'https://cdn.example' }),
  ).rejects.toThrow('Denied');
  expect(n).toBe(1);
  await expect(
    publishAssets([{ ...input[0]!, key: '../secrets' }], {
      target: t.storage,
      publicBase: 'https://cdn.example',
    }),
  ).rejects.toThrow(/verified/);
});
it('garbage collection previews by default and protects recent deployments and other targets', async () => {
  const t = target();
  const previous = (
    await publishAssets(input, { target: t.storage, publicBase: 'https://cdn.example' })
  ).manifest;
  const current = { ...previous, entries: [] };
  await expect(collectGarbage(previous, current, { target: t.storage })).rejects.toThrow(/recent/);
  previous.generatedAt = '2020-01-01T00:00:00Z';
  expect(await collectGarbage(previous, current, { target: t.storage })).toEqual([key]);
  expect(t.storage.delete).not.toHaveBeenCalled();
  await collectGarbage(previous, current, { target: t.storage, confirm: true });
  expect(t.storage.delete).toHaveBeenCalledWith(key);
  await expect(
    collectGarbage(previous, { ...current, target: 'other' }, { target: t.storage, confirm: true }),
  ).rejects.toThrow(/targets/);
});
it('rewrites only owned image URLs in a real Vite build and emits the upload manifest', async () => {
  const { build } = await import('vite');
  const url = new URL('../packages/svelte-imageway/dist/vite/index.js', import.meta.url);
  const { imageway } = await import(url.href);
  const sharp = (await import('sharp')).default;
  const root = await mkdtemp(join(tmpdir(), 'imageway-publish-vite-'));
  const t = target();
  try {
    await writeFile(
      join(root, 'a.png'),
      await sharp({ create: { width: 320, height: 200, channels: 3, background: 'blue' } })
        .png()
        .toBuffer(),
    );
    await writeFile(join(root, 'index.html'), '<script type="module" src="/main.js"></script>');
    await writeFile(
      join(root, 'main.js'),
      "import a from './a.png?w=320&format=webp&img'; console.log(a, '/unrelated.svg');",
    );
    await build({
      root,
      configFile: false,
      logLevel: 'silent',
      plugins: [imageway({ publish: { target: t.storage, publicBase: 'https://cdn.example' } })],
      build: {
        minify: false,
        outDir: 'dist',
        rollupOptions: { output: { entryFileNames: 'app.js' } },
      },
    });
    const code = await readFile(join(root, 'dist/app.js'), 'utf8');
    expect(code).toContain('https://cdn.example/imageway/');
    expect(code).toContain('/unrelated.svg');
    const m = JSON.parse(await readFile(join(root, 'dist/image-manifest.json'), 'utf8'));
    expect(m.entries).toHaveLength(1);
    expect(t.put).toHaveBeenCalledTimes(1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { hash } from '../node/cache.js';
import { invariant } from '../core/errors.js';
import { PIPELINE_REVISION } from '../version.js';
export interface StorageHead {
  size: number;
  hash?: string;
}
export interface StorageTarget {
  /** Stable nonsecret bucket/location identity; changing credentials must not change identity. */
  id: string;
  head(key: string): Promise<StorageHead | undefined>;
  put(
    key: string,
    bytes: Uint8Array,
    metadata: { contentType: string; cacheControl: string; hash: string },
  ): Promise<void>;
  delete?(key: string): Promise<void>;
}
export interface PublishAsset {
  key: string;
  bytes: Uint8Array;
  contentType: string;
}
export interface ManifestEntry {
  key: string;
  hash: string;
  size: number;
  contentType: string;
  url: string;
}
export interface ImageManifest {
  version: 1;
  pipeline: string;
  target: string;
  publicBase: string;
  generatedAt: string;
  entries: ManifestEntry[];
}
export interface PublishOptions {
  target: StorageTarget;
  publicBase: string;
  manifestPath?: string;
  dryRun?: boolean;
  concurrency?: number;
  retries?: number;
}
const keyPattern = /^imageway\/[a-f0-9]{64}\.(avif|webp|jpeg|png|gif|svg)$/;
export function publicAssetBase(value: string): string {
  const u = new URL(value);
  invariant(
    u.protocol === 'https:' && !u.username && !u.password && !u.search && !u.hash,
    'PUBLISH_BASE',
    'publicBase must be an HTTPS CDN URL without credentials/query.',
  );
  return u.href.replace(/\/$/, '');
}
async function retry<T>(run: () => Promise<T>, count: number): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run();
    } catch (error) {
      const e = error as { status?: number; $metadata?: { httpStatusCode?: number } };
      const status = e.status ?? e.$metadata?.httpStatusCode;
      if (attempt >= count || (status && status !== 429 && status < 500)) throw error;
      await new Promise((r) => setTimeout(r, Math.min(1000, 50 * 2 ** attempt)));
    }
  }
}
/** Upload immutable content-addressed variants; re-running after interruption resumes using remote HEAD. */
export async function publishAssets(
  assets: readonly PublishAsset[],
  options: PublishOptions,
): Promise<{ manifest: ImageManifest; uploaded: number; skipped: number; planned: number }> {
  const base = publicAssetBase(options.publicBase);
  const concurrency = options.concurrency ?? 4,
    retries = options.retries ?? 2;
  invariant(
    Number.isInteger(concurrency) &&
      concurrency >= 1 &&
      concurrency <= 16 &&
      Number.isInteger(retries) &&
      retries >= 0 &&
      retries <= 5,
    'PUBLISH_LIMIT',
    'Use concurrency 1–16 and retries 0–5.',
  );
  const unique = new Map<string, PublishAsset>();
  for (const item of assets) {
    invariant(
      keyPattern.test(item.key) && item.key.split('/')[1]!.startsWith(hash(item.bytes) + '.'),
      'PUBLISH_HASH',
      'Publish only verified imageway content-addressed assets.',
    );
    unique.set(item.key, item);
  }
  const items = [...unique.values()].sort((a, b) => a.key.localeCompare(b.key));
  const manifest: ImageManifest = {
    version: 1,
    pipeline: PIPELINE_REVISION,
    target: options.target.id,
    publicBase: base,
    generatedAt: new Date().toISOString(),
    entries: items.map((v) => ({
      key: v.key,
      hash: hash(v.bytes),
      size: v.bytes.length,
      contentType: v.contentType,
      url: base + '/' + v.key,
    })),
  };
  let index = 0,
    uploaded = 0,
    skipped = 0;
  if (!options.dryRun)
    await Promise.all(
      Array.from({ length: concurrency }, async () => {
        while (index < items.length) {
          const item = items[index++]!;
          const digest = hash(item.bytes);
          const previous = await retry(() => options.target.head(item.key), retries);
          if (
            previous?.size === item.bytes.length &&
            (!previous.hash || previous.hash === digest)
          ) {
            skipped++;
            continue;
          }
          await retry(
            () =>
              options.target.put(item.key, item.bytes, {
                contentType: item.contentType,
                cacheControl: 'public, max-age=31536000, immutable',
                hash: digest,
              }),
            retries,
          );
          uploaded++;
        }
      }),
    );
  if (options.manifestPath && !options.dryRun) {
    await mkdir(dirname(options.manifestPath), { recursive: true });
    const tmp = options.manifestPath + '.' + crypto.randomUUID() + '.tmp';
    await writeFile(tmp, JSON.stringify(manifest, null, 2) + '\n');
    await rename(tmp, options.manifestPath);
  }
  return { manifest, uploaded, skipped, planned: items.length };
}
export async function readManifest(path: string): Promise<ImageManifest> {
  const value = JSON.parse(await readFile(path, 'utf8')) as ImageManifest;
  invariant(
    value.version === 1 && Array.isArray(value.entries),
    'MANIFEST',
    'Unsupported image manifest.',
  );
  return value;
}
/** Only known prior-manifest objects may be deleted. Retain old manifests for deployed pages and allow a grace period. */
export async function collectGarbage(
  previous: ImageManifest,
  current: ImageManifest,
  options: { target: StorageTarget; confirm?: boolean; minimumAgeMs?: number },
): Promise<string[]> {
  invariant(
    previous.target === current.target &&
      current.target === options.target.id &&
      previous.publicBase === current.publicBase,
    'GC_TARGET',
    'Refuse garbage collection across targets/bases.',
  );
  invariant(
    Date.now() - Date.parse(previous.generatedAt) >= (options.minimumAgeMs ?? 30 * 86400_000),
    'GC_AGE',
    'Prior manifest is too recent; protect deployed pages.',
  );
  const keep = new Set(current.entries.map((v) => v.key));
  const stale = previous.entries.filter((v) => !keep.has(v.key)).map((v) => v.key);
  invariant(
    stale.every((v) => keyPattern.test(v)),
    'GC_KEY',
    'Refuse unknown storage keys.',
  );
  if (options.confirm) {
    invariant(options.target.delete, 'GC_DELETE', 'Target cannot delete.');
    for (const key of stale) await options.target.delete(key);
  }
  return stale;
}

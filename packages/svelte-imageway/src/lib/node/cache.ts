import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, stat, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { invariant } from '../core/errors.js';

/** Content hashes are independent of filesystem paths and upstream credentials. */
export function hash(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}
/** Byte-bounded LRU, without retaining oversized entries. */
export class MemoryCache {
  private values = new Map<string, { bytes: Buffer; expires: number }>();
  private size = 0;
  constructor(
    public readonly maxBytes = 32_000_000,
    private readonly now: () => number = Date.now,
  ) {
    invariant(maxBytes > 0, 'CACHE', 'Memory cache budget must be positive.');
  }
  get(key: string): Buffer | undefined {
    const value = this.values.get(key);
    if (!value) return;
    this.values.delete(key);
    this.size -= value.bytes.length;
    if (value.expires <= this.now()) return;
    this.values.set(key, value);
    this.size += value.bytes.length;
    return Buffer.from(value.bytes);
  }
  set(key: string, bytes: Buffer, ttlMs: number): void {
    this.delete(key);
    if (bytes.length > this.maxBytes || ttlMs <= 0) return;
    while (this.size + bytes.length > this.maxBytes) this.delete(this.values.keys().next().value!);
    this.values.set(key, { bytes: Buffer.from(bytes), expires: this.now() + ttlMs });
    this.size += bytes.length;
  }
  delete(key: string): void {
    const value = this.values.get(key);
    if (value) {
      this.values.delete(key);
      this.size -= value.bytes.length;
    }
  }
  get bytes(): number {
    return this.size;
  }
}
/** Atomic, hash-keyed disk cache with TTL and a bounded storage budget. */
export class DiskCache {
  constructor(
    public readonly directory: string,
    public readonly maxBytes = 256_000_000,
  ) {}
  private path(key: string): string {
    return join(this.directory, hash(key));
  }
  async get(key: string, ttlMs = Infinity): Promise<Buffer | undefined> {
    try {
      const path = this.path(key);
      const info = await stat(path);
      if (info.size > this.maxBytes || ttlMs <= 0 || Date.now() - info.mtimeMs >= ttlMs) {
        await rm(path, { force: true });
        return;
      }
      return await readFile(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }
  }
  async set(key: string, data: Buffer): Promise<void> {
    if (data.length > this.maxBytes) return;
    await mkdir(this.directory, { recursive: true });
    const path = this.path(key),
      temp = `${path}.${randomUUID()}.tmp`;
    try {
      await import('node:fs/promises').then((fs) =>
        fs.writeFile(temp, data, { flag: 'wx', mode: 0o600 }),
      );
      await rename(temp, path);
    } finally {
      await rm(temp, { force: true });
    }
    const files = await Promise.all(
      (await readdir(this.directory))
        .filter((name) => /^[a-f\d]{64}$/.test(name))
        .map(async (name) => ({
          path: join(this.directory, name),
          info: await stat(join(this.directory, name)).catch(() => undefined),
        })),
    );
    let size = files.reduce((total, v) => total + (v.info?.size ?? 0), 0);
    for (const file of files.sort((a, b) => (a.info?.mtimeMs ?? 0) - (b.info?.mtimeMs ?? 0))) {
      if (size <= this.maxBytes) break;
      await rm(file.path, { force: true });
      size -= file.info?.size ?? 0;
    }
  }
  async delete(key: string): Promise<void> {
    await rm(this.path(key), { force: true });
  }
}
/** Deduplicate concurrent work with a hard cap on outstanding distinct jobs. */
export class SingleFlight<T> {
  private pending = new Map<string, Promise<T>>();
  constructor(private readonly maxPending = 64) {}
  run(key: string, job: () => Promise<T>): Promise<T> {
    const existing = this.pending.get(key);
    if (existing) return existing;
    invariant(this.pending.size < this.maxPending, 'QUEUE', 'Image queue capacity reached.', 429);
    const result = Promise.resolve()
      .then(job)
      .finally(() => this.pending.delete(key));
    this.pending.set(key, result);
    return result;
  }
}

import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, stat, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
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
    if (bytes.length === 0 || bytes.length > this.maxBytes || ttlMs <= 0) return;
    while (this.values.size >= 4096 || this.size + bytes.length > this.maxBytes)
      this.delete(this.values.keys().next().value!);
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
interface DiskIndex {
  files: Map<string, number>;
  bytes: number;
  scannedAt: number;
  pending: Promise<unknown>;
}
const diskIndexes = new Map<string, WeakRef<DiskIndex>>();
function diskIndex(directory: string): DiskIndex {
  const existing = diskIndexes.get(directory)?.deref();
  if (existing) return existing;
  for (const [key, reference] of diskIndexes) if (!reference.deref()) diskIndexes.delete(key);
  const index: DiskIndex = { files: new Map(), bytes: 0, scannedAt: 0, pending: Promise.resolve() };
  diskIndexes.set(directory, new WeakRef(index));
  return index;
}
/** Atomic hash-keyed cache. Writers share an index and reconcile external changes every 30 seconds. */
export class DiskCache {
  readonly directory: string;
  private index: DiskIndex;
  constructor(
    directory: string,
    public readonly maxBytes = 256_000_000,
  ) {
    this.directory = resolve(directory);
    this.index = diskIndex(this.directory);
  }
  private path(key: string): string {
    return join(this.directory, hash(key));
  }
  private exclusive<T>(run: () => Promise<T>): Promise<T> {
    const operation = this.index.pending.then(run);
    this.index.pending = operation.catch(() => {});
    return operation;
  }
  private forget(path: string): void {
    this.index.bytes -= this.index.files.get(path) ?? 0;
    this.index.files.delete(path);
  }
  private async reconcile(): Promise<void> {
    if (this.index.scannedAt && Date.now() - this.index.scannedAt < 30_000) return;
    const names = (await readdir(this.directory)).filter((name) => /^[a-f\d]{64}$/.test(name));
    const files: Array<{ path: string; size: number; time: number }> = [];
    let cursor = 0;
    await Promise.all(
      Array.from({ length: Math.min(8, names.length) }, async () => {
        while (cursor < names.length) {
          const path = join(this.directory, names[cursor++]!);
          try {
            const info = await stat(path);
            files.push({ path, size: info.size, time: info.mtimeMs });
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
          }
        }
      }),
    );
    this.index.files = new Map(files.sort((a, b) => a.time - b.time).map((v) => [v.path, v.size]));
    this.index.bytes = files.reduce((total, file) => total + file.size, 0);
    this.index.scannedAt = Date.now();
  }
  async get(key: string, ttlMs = Infinity): Promise<Buffer | undefined> {
    try {
      const path = this.path(key);
      const info = await stat(path);
      if (info.size > this.maxBytes || ttlMs <= 0 || Date.now() - info.mtimeMs >= ttlMs) {
        await this.delete(key);
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
    return this.exclusive(async () => {
      await mkdir(this.directory, { recursive: true });
      await this.reconcile();
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
      this.forget(path);
      this.index.files.set(path, data.length);
      this.index.bytes += data.length;
      while (this.index.bytes > this.maxBytes) {
        const oldest = this.index.files.keys().next().value!;
        await rm(oldest, { force: true });
        this.forget(oldest);
      }
    });
  }
  async delete(key: string): Promise<void> {
    return this.exclusive(async () => {
      const path = this.path(key);
      await rm(path, { force: true });
      this.forget(path);
    });
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

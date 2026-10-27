import { PIPELINE_REVISION } from '../version.js';
import { defineConfig } from '../core/config.js';
import { cacheIdentity, normalizeRequest } from '../core/url.js';
import type { ImageConfig, ImageRequest, OutputFormat } from '../core/types.js';
import { DiskCache, hash, ValueCache, SingleFlight } from './cache.js';
import { loadSharp, type TransformResult } from './pipeline.js';
import { TransformPool, sharedPool } from './pool.js';
import { invariant } from '../core/errors.js';

/** Persistent content/codec/policy-addressed processing with in-flight deduplication. */
export interface ProcessedImage extends TransformResult {
  cacheHit: boolean;
}
/** An owned source snapshot. Neither its bytes nor a mutable alias are exposed. */
export interface PreparedImageSource {
  readonly byteLength: number;
  readonly digest: string;
  process(
    input: ImageRequest,
    format: OutputFormat,
    qualityCap?: number,
    preview?: boolean,
  ): Promise<ProcessedImage>;
}
export class ImageProcessor {
  readonly metrics = { hit: 0, miss: 0, transforms: 0 };
  private memory: ValueCache<{ value: TransformResult; bytes: number }>;
  private disk: DiskCache;
  private flight = new SingleFlight<ProcessedImage>();
  protected pool: Pick<TransformPool, 'run' | 'runBuild'>;
  private build: boolean;
  constructor(options: {
    directory: string;
    config?: ImageConfig;
    concurrency?: number;
    memoryBytes?: number;
    diskBytes?: number;
    onTransform?: () => void | Promise<void>;
    /** Finite build batches wait outside the runtime request queue. */
    build?: boolean;
  }) {
    this.build = options.build ?? false;
    this.onTransform = options.onTransform;
    this.config = defineConfig({ ...options.config, provider: undefined, providers: undefined });
    this.memory = new ValueCache(options.memoryBytes ?? 32_000_000);
    this.disk = new DiskCache(options.directory, options.diskBytes);
    this.pool = sharedPool(options.concurrency);
  }
  private config: ImageConfig;
  private policyRevision?: string;
  private onTransform?: () => void | Promise<void>;
  private remember(key: string, value: TransformResult, bytes: number): void {
    if (bytes > this.memory.maxBytes) return;
    // The cache owns this copy; no caller receives an alias to its payload.
    this.memory.set(
      key,
      { value: { ...value, data: Buffer.from(value.data) }, bytes },
      bytes,
      3600_000,
    );
  }
  /** Copy once at ingestion; repeated transforms reuse the immutable source identity. */
  prepare(data: Uint8Array): PreparedImageSource {
    invariant(
      data.byteLength > 0 && data.byteLength <= this.config.maxInputBytes,
      'INPUT_SIZE',
      'Input exceeds configured byte limit.',
      413,
    );
    // Build variants share one private, immutable backing store across workers.
    // Runtime snapshots retain the original copy/admission behavior. Never expose
    // this buffer or transfer it: prepared sources may have concurrent readers.
    const snapshot = this.build
      ? Buffer.from(new SharedArrayBuffer(data.byteLength))
      : Buffer.from(data);
    if (this.build) snapshot.set(data);
    const digest = hash(snapshot);
    return Object.freeze({
      byteLength: snapshot.byteLength,
      digest,
      process: (input: ImageRequest, format: OutputFormat, qualityCap?: number, preview = true) =>
        this.processSource(snapshot, digest, input, format, qualityCap, preview),
    });
  }
  async process(
    data: Uint8Array,
    input: ImageRequest,
    format: OutputFormat,
    qualityCap?: number,
    preview = true,
  ): Promise<ProcessedImage> {
    invariant(
      data.byteLength > 0 && data.byteLength <= this.config.maxInputBytes,
      'INPUT_SIZE',
      'Input exceeds configured byte limit.',
      413,
    );
    return this.processSource(data, undefined, input, format, qualityCap, preview);
  }
  private async processSource(
    data: Uint8Array,
    digest: string | undefined,
    input: ImageRequest,
    format: OutputFormat,
    qualityCap?: number,
    preview = true,
  ): Promise<ProcessedImage> {
    const normalized = normalizeRequest(input, this.config);
    const request =
      qualityCap === undefined
        ? normalized
        : Object.freeze({
            ...normalized,
            q:
              this.config.qualities.filter((q) => q <= qualityCap && q <= normalized.q).at(-1) ??
              normalized.q,
          });
    const sharp = await loadSharp();
    // Config is an owned frozen snapshot; codec identity is fixed for this process.
    this.policyRevision ??= hash(PIPELINE_REVISION + JSON.stringify([sharp.versions, this.config]));
    const key = hash(
      `${digest ?? hash(data)}:preview=${preview}:${cacheIdentity(request, format, this.policyRevision, this.config)}`,
    );
    return this.flight.run(key, async () => {
      const memory = this.memory.get(key);
      if (memory) {
        this.memory.set(key, memory, memory.bytes, 3600_000);
        this.metrics.hit++;
        return { ...memory.value, data: Buffer.from(memory.value.data), cacheHit: true };
      }
      const cached = await this.disk.get(key);
      if (cached) {
        try {
          const result = unpack(cached);
          this.remember(key, result, cached.length);
          this.metrics.hit++;
          return { ...result, cacheHit: true };
        } catch {
          await this.disk.delete(key);
        }
      }
      await this.onTransform?.();
      this.metrics.miss++;
      this.metrics.transforms++;
      const task = { data, request, format, config: this.config, preview };
      const result = await (this.build ? this.pool.runBuild(task) : this.pool.run(task));
      const packed = pack(result);
      await this.disk.set(key, packed);
      this.remember(key, result, packed.length);
      return { ...result, cacheHit: false };
    });
  }
}
function pack({ data, ...metadata }: TransformResult): Buffer {
  const header = Buffer.from(JSON.stringify(metadata));
  const length = Buffer.alloc(4);
  length.writeUInt32BE(header.length);
  return Buffer.concat([length, header, data]);
}
function unpack(bytes: Buffer): TransformResult {
  const length = bytes.readUInt32BE(0);
  if (length > 8192 || length + 4 >= bytes.length) throw new Error('Invalid cached artifact.');
  const metadata = JSON.parse(bytes.toString('utf8', 4, length + 4)) as Omit<
    TransformResult,
    'data'
  >;
  if (
    !Number.isSafeInteger(metadata.width) ||
    !Number.isSafeInteger(metadata.height) ||
    !metadata.format
  )
    throw new Error('Invalid cached metadata.');
  return { ...metadata, data: Buffer.from(bytes.subarray(length + 4)) };
}

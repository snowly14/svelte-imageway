import { PIPELINE_REVISION } from '../version.js';
import { defaults } from '../core/config.js';
import { cacheIdentity, normalizeRequest } from '../core/url.js';
import type { ImageConfig, ImageRequest, OutputFormat } from '../core/types.js';
import { DiskCache, hash, MemoryCache, SingleFlight } from './cache.js';
import { loadSharp, type TransformResult } from './pipeline.js';
import { TransformPool, sharedPool } from './pool.js';

/** Persistent content/codec/policy-addressed processing with in-flight deduplication. */
export interface ProcessedImage extends TransformResult {
  cacheHit: boolean;
}
export class ImageProcessor {
  readonly metrics = { hit: 0, miss: 0, transforms: 0 };
  private memory: MemoryCache;
  private disk: DiskCache;
  private flight = new SingleFlight<ProcessedImage>();
  private pool: TransformPool;
  constructor(options: {
    directory: string;
    config?: ImageConfig;
    concurrency?: number;
    memoryBytes?: number;
    diskBytes?: number;
    onTransform?: () => void | Promise<void>;
  }) {
    this.onTransform = options.onTransform;
    this.config = { ...(options.config ?? defaults), provider: undefined, providers: undefined };
    this.memory = new MemoryCache(options.memoryBytes);
    this.disk = new DiskCache(options.directory, options.diskBytes);
    this.pool = sharedPool(options.concurrency);
  }
  private config: ImageConfig;
  private onTransform?: () => void | Promise<void>;
  async process(
    data: Uint8Array,
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
    const key = hash(
      `${hash(data)}:preview=${preview}:${cacheIdentity(request, format, PIPELINE_REVISION + JSON.stringify(sharp.versions), this.config)}`,
    );
    return this.flight.run(key, async () => {
      const cached = this.memory.get(key) ?? (await this.disk.get(key));
      if (cached) {
        try {
          const result = unpack(cached);
          this.memory.set(key, cached, 3600_000);
          this.metrics.hit++;
          return { ...result, cacheHit: true };
        } catch {
          await this.disk.delete(key);
        }
      }
      await this.onTransform?.();
      this.metrics.miss++;
      this.metrics.transforms++;
      const result = await this.pool.run({ data, request, format, config: this.config, preview });
      const packed = pack(result);
      await this.disk.set(key, packed);
      this.memory.set(key, packed, 3600_000);
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

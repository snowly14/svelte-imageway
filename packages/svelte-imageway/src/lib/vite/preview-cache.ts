import type { ImageConfig } from '../core/types.js';
import { DiskCache, ValueCache, hash } from '../node/cache.js';
import { PIPELINE_REVISION } from '../version.js';
import type { placeholder } from './placeholder.js';

type Preview = Readonly<Awaited<ReturnType<typeof placeholder>>>;
const maxEntryBytes = 32_768;
const ttl = 365 * 24 * 60 * 60 * 1000;

/** Build-only metadata cache. Source admission and metadata checks precede this cache. */
export class PreviewCache {
  private readonly memory = new ValueCache<Preview>(4_000_000);
  private readonly disk: DiskCache;
  constructor(directory: string) {
    this.disk = new DiskCache(directory, 8_000_000);
  }
  async resolve(
    digest: string,
    strategy: ImageConfig['placeholder'],
    limits: Pick<ImageConfig, 'maxPixels' | 'maxInputBytes' | 'timeoutMs'>,
    codecs: object,
    generate: () => Promise<Preview>,
  ): Promise<Preview> {
    if (strategy === 'none') return {};
    const key = hash(
      JSON.stringify([
        PIPELINE_REVISION,
        digest,
        strategy,
        limits.maxPixels,
        limits.maxInputBytes,
        limits.timeoutMs,
        codecs,
      ]),
    );
    const existing = this.memory.get(key);
    if (existing) return existing;
    const bytes = await this.disk.get(key, ttl);
    if (bytes) {
      try {
        if (bytes.length > maxEntryBytes) throw Error('Oversized preview cache entry.');
        const value: unknown = JSON.parse(bytes.toString('utf8'));
        if (!valid(value, strategy)) throw Error('Invalid preview cache entry.');
        const result = Object.freeze(value);
        this.memory.set(key, result, bytes.length, ttl);
        return result;
      } catch {
        await this.disk.delete(key);
      }
    }
    const result = Object.freeze({ ...(await generate()) });
    const encoded = Buffer.from(JSON.stringify(result));
    if (encoded.length <= maxEntryBytes && valid(result, strategy)) {
      await this.disk.set(key, encoded);
      this.memory.set(key, result, encoded.length, ttl);
    }
    return result;
  }
}

function valid(value: unknown, strategy: ImageConfig['placeholder']): value is Preview {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  const keys =
    strategy === 'color'
      ? ['dominantColor']
      : strategy === 'lqip'
        ? ['dominantColor', 'placeholder']
        : ['dominantColor', 'placeholder', 'placeholderHash'];
  if (Object.keys(item).length !== keys.length || keys.some((key) => typeof item[key] !== 'string'))
    return false;
  if (!/^#[a-f\d]{6}$/i.test(item.dominantColor as string)) return false;
  if (
    strategy !== 'color' &&
    !/^data:image\/(?:webp|png);base64,[A-Za-z0-9+/]+=*$/.test(item.placeholder as string)
  )
    return false;
  return !keys.includes('placeholderHash') || (item.placeholderHash as string).length <= 256;
}

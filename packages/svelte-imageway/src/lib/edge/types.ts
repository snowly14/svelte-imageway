import type { NormalizedRequest, ImageConfig } from '../core/types.js';
/** Minimal structural interfaces, checked against real Cloudflare bindings by Wrangler tests. */
export interface ObjectBody {
  size: number;
  body: ReadableStream<Uint8Array>;
  customMetadata?: Record<string, string>;
  httpMetadata?: { contentType?: string };
  arrayBuffer(): Promise<ArrayBuffer>;
}
export interface ObjectBucket {
  get(key: string): Promise<ObjectBody | null>;
  put(
    key: string,
    value: Uint8Array,
    options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> },
  ): Promise<unknown>;
}
export interface ImageTransformOptions {
  width?: number;
  height?: number;
  fit?: 'scale-down' | 'contain' | 'pad' | 'squeeze' | 'cover' | 'crop';
  rotate?: 0 | 90 | 180 | 270;
  gravity?: string | { x: number; y: number; mode: 'remainder' | 'box-center' };
  flip?: 'h' | 'v' | 'hv';
  blur?: number;
  sharpen?: number;
  background?: string;
}
export interface ImagesBindingLike {
  info(
    stream: ReadableStream<Uint8Array>,
  ): Promise<{ format: string; width?: number; height?: number }>;
  input(stream: ReadableStream<Uint8Array>): {
    transform(options: ImageTransformOptions): {
      output(options: {
        format: string;
        quality?: number;
        anim?: boolean;
      }): Promise<{ response(): Response }>;
    };
  };
}
export interface CacheLike {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}
export interface BudgetNamespace {
  getByName(name: string): { fetch(request: Request): Promise<Response> };
}
export interface EdgeEnv {
  ORIGINALS: ObjectBucket;
  IMAGES?: ImagesBindingLike;
  VARIANTS?: ObjectBucket;
  BUDGET: BudgetNamespace;
  SOURCE_PREFIX?: string;
  PUBLIC_SOURCES?: string;
  SIGNING_KEY_CURRENT?: string;
  SIGNING_KEY_PREVIOUS?: string;
  PURGE_TOKEN?: string;
  METRICS_TOKEN?: string;
  LOCAL_OFFLINE?: string;
  CORS_ORIGIN?: string;
  MAX_REQUESTS_PER_MINUTE?: string;
  MAX_TRANSFORMS_PER_HOUR?: string;
  MAX_TRANSFORMS_PER_MONTH?: string;
  DEBUG?: string;
}
export interface ExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void;
}
export interface WorkerOptions {
  config?: Partial<ImageConfig>;
  cache?: CacheLike;
  /** Optional platform-native transform for operator-controlled public object origins. */
  transform?: (
    request: NormalizedRequest,
    bytes: Uint8Array,
    env: EdgeEnv,
    format: string,
  ) => Promise<Response>;
  observe?: (event: { status: number; durationMs: number; cache: string }) => void;
}

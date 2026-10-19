import type { Adapter } from '@sveltejs/kit';
import { invariant } from '../core/errors.js';
import { defaults } from '../core/config.js';
import type { ImageConfig } from '../core/types.js';
export type ImageTarget = 'static' | 'node' | 'bun' | 'vercel' | 'netlify' | 'cloudflare' | 'deno';
export interface AdapterStrategy { target: ImageTarget; processing: 'build' | 'sharp' | 'native' | 'external'; persistentDisk: boolean }
/** Detect actual official adapter names; auto/unknown adapters require an explicit target. */
export function imageStrategy(adapter: Pick<Adapter, 'name'>, target?: ImageTarget): AdapterStrategy {
  const match = adapter.name.match(/(?:@sveltejs\/)?adapter-(static|node|vercel|netlify|cloudflare)(?:$|\b)/);
  const detected = target ?? match?.[1] as ImageTarget | undefined;
  invariant(detected, 'ADAPTER', 'Cannot infer the deployment runtime. Pass imageAdapter(adapter, { target: "node" | "static" | "cloudflare" | ... }).');
  return { target: detected, processing: detected === 'static' ? 'build' : ['node', 'bun'].includes(detected) ? 'sharp' : detected === 'deno' ? 'external' : 'native', persistentDisk: ['node', 'bun'].includes(detected) };
}
/** Preserve the complete current adapter interface while enforcing runtime/provider compatibility. */
export interface ImageAdapterOptions { target?: ImageTarget; provider?: 'local' | 'native' | 'edge' | 'generic'; config?: ImageConfig; adapterOptions?: Record<string, unknown> }
export function imageAdapter(adapter: Adapter, options?: ImageAdapterOptions): Adapter;
export function imageAdapter(target: ImageTarget, options?: ImageAdapterOptions): Promise<Adapter>;
export function imageAdapter(adapter: Adapter | ImageTarget, options: ImageAdapterOptions = {}): Adapter | Promise<Adapter> {
  if (typeof adapter === 'string') return nativeAdapter(adapter, options);
  const strategy = imageStrategy(adapter, options.target);
  invariant(!(options.provider === 'local' && ['cloudflare', 'vercel', 'netlify', 'deno'].includes(strategy.target)), 'ADAPTER_PROVIDER', 'Local Sharp is unavailable in this target. Choose its native provider or an external Edge service.');
  return { ...adapter, name: adapter.name,
    vite(ctx) {
      const original = (typeof adapter.vite === 'function' ? adapter.vite(ctx) : adapter.vite) ?? {};
      const pre = Array.isArray(original.plugins) ? original.plugins : original.plugins?.pre ?? [];
      const post = Array.isArray(original.plugins) ? [] : original.plugins?.post ?? [];
      return { ...original, plugins: { pre: [...pre, { name: 'imageway-adapter-target', configResolved(config) {
        const imageway = config.plugins.find(p => p.name === 'svelte-imageway') as { api?: { setTarget?: (target: ImageTarget) => void } } | undefined;
        imageway?.api?.setTarget?.(strategy.target);
      } }], post } };
    }, async adapt(builder) { builder.log.info(`Imageway: ${strategy.target} / ${strategy.processing}; persistent disk ${strategy.persistentDisk ? 'available' : 'disabled'}`); await adapter.adapt(builder); } };
}

async function nativeAdapter(target: ImageTarget, options: ImageAdapterOptions): Promise<Adapter> {
  invariant(!['bun', 'deno'].includes(target), 'ADAPTER', 'Pass the actual verified Bun/Deno adapter object with an explicit target.');
  const moduleId = `@sveltejs/adapter-${target}`;
  let factory: (options?: Record<string, unknown>) => Adapter;
  try { factory = (await import(moduleId)).default; } catch { throw new Error(`Install ${moduleId} with bun add -d ${moduleId}, or pass your existing adapter object.`); }
  const config = options.config ?? defaults;
  const native = target === 'vercel' ? { images: { sizes: [...config.widths], formats: config.formats.filter(v => v === 'avif' || v === 'webp').map(v => `image/${v}`), domains: config.allowedOrigins.map(v => new URL(v).hostname), minimumCacheTTL: 60 } } : {};
  return imageAdapter(factory({ ...native, ...options.adapterOptions }), { ...options, target });
}

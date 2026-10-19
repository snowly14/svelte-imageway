import type { Plugin, ResolvedConfig } from 'vite';
import { relative, join } from 'node:path';
import { defineConfig } from '../core/config.js';
import { ImagewayError } from '../core/errors.js';
import { mimeType } from '../core/accept.js';
import type { ImageArtifact, ImageConfig, ImageRequest, OutputFormat } from '../core/types.js';
import { hash } from '../node/cache.js';
import { readLocal } from '../node/source.js';
import { loadSharp, sniff } from '../node/pipeline.js';
import { ImageProcessor } from '../node/processor.js';
import { optimize } from 'svgo';
import { parseDirectives } from './directives.js';
import { placeholder } from './placeholder.js';
import { generateImageTypes } from './typegen.js';
export { generateImageTypes } from './typegen.js';

export { parseDirectives } from './directives.js';
export interface ImagePluginOptions {
  config?: Partial<ImageConfig>;
  concurrency?: number;
  publicBase?: string;
  /** Optional notification, never called for every progress tick. */
  onProgress?: (result: { file: string; variants: number }) => void;
}
/** Typed responsive imports with lazy dev endpoints and persistent content-addressed builds. */
export function imageway(options: ImagePluginOptions = {}): Plugin {
  const config = defineConfig(options.config);
  let vite: ResolvedConfig;
  const jobs = new Map<string, { file: string; run: () => Promise<Buffer>; format: OutputFormat }>();
  return {
    name: 'svelte-imageway', enforce: 'pre',
    async configResolved(resolved) {
      vite = resolved;
      await generateImageTypes(vite.root);
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const job = jobs.get((req.url ?? '').split('?')[0]!);
        if (!job) return next();
        if (req.method !== 'GET' && req.method !== 'HEAD') { res.statusCode = 405; res.end(); return; }
        void job.run().then(data => { res.setHeader('Content-Type', mimeType(job.format)); res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); res.setHeader('X-Content-Type-Options', 'nosniff'); res.end(req.method === 'HEAD' ? undefined : data); }).catch(error => { res.statusCode = error instanceof ImagewayError ? error.status : 500; res.end('Image processing failed. Check the configured codec and source limits.'); });
      });
    },
    async handleHotUpdate(ctx) {
      if (/\.(svelte|[jt]s)$/.test(ctx.file)) await generateImageTypes(vite.root);
      // Old URLs are content-addressed and may remain in already-rendered pages; bound their retention.
      if (jobs.size > 2048) for (const [key, job] of jobs) if (job.file === ctx.file) jobs.delete(key);
    },
    async load(id) {
      const split = id.indexOf('?');
      if (split < 0 || !new URLSearchParams(id.slice(split + 1)).has('img')) return;
      const file = id.slice(0, split);
      this.addWatchFile(file);
      const source = await readLocal(relative(vite.root, file), vite.root, config.maxInputBytes);
      const kind = sniff(source);
      const sharp = await loadSharp();
      const metadata = await sharp(source, { limitInputPixels: config.maxPixels }).metadata();
      const dimensions = metadata.autoOrient;
      const directives = parseDirectives(id.slice(split + 1), dimensions.width, config);
      const formats = [...directives.formats];
      if ((metadata.pages ?? 1) > 1 && directives.transforms.animation !== 'first') {
        for (let i = formats.length - 1; i >= 0; i--) if (!['webp', 'gif'].includes(formats[i]!)) formats.splice(i, 1);
        if (!formats.length) formats.push('webp');
      }
      if (metadata.hasAlpha && !formats.includes('png') && formats.includes('jpeg')) formats.splice(formats.indexOf('jpeg'), 1, 'png');
      const tokenUrls = new Map<string, string>();
      const outputs: Array<{ format: OutputFormat; width: number; height: number; url: string }> = [];
      const exactConfig = defineConfig({ ...config, widths: directives.widths, qualities: [directives.quality], quality: directives.quality });
      const exactProcessor = new ImageProcessor({ directory: join(vite.root, 'node_modules/.cache/svelte-imageway'), config: exactConfig, concurrency: options.concurrency });
      const variants = formats.flatMap(format => (format === 'svg' ? [dimensions.width] : directives.widths).map(width => ({ format, width })));
      await Promise.all(variants.map(async ({ format, width }) => {
          const request: ImageRequest = { key: 'import', ...directives.transforms, w: width, q: directives.quality };
          // Exact requested widths/qualities belong to build configuration, not dynamic URL ladders.
          const digest = hash(`${hash(source)}:${JSON.stringify(request)}:${format}:${JSON.stringify(sharp.versions)}`);
          let url: string;
          const run = async () => {
            if (format !== 'svg') return exactProcessor.process(source, request, format);
            if (kind !== 'svg') throw new ImagewayError('SVG', 'Only approved SVG inputs can produce SVG output.');
            const optimized = optimize(source.toString('utf8'), { multipass: true }).data;
            sniff(Buffer.from(optimized));
            return { data: Buffer.from(optimized), width: dimensions.width, height: dimensions.height };
          };
          let outputWidth = width;
          let height = Math.max(1, Math.round((directives.transforms.h ?? dimensions.height * width / dimensions.width)));
          if (vite.command === 'serve') {
            url = `${vite.base}@imageway/${digest}.${format}`;
            jobs.set(url, { file, format, run: async () => (await run()).data });
          } else {
            const output = await run();
            height = output.height; outputWidth = output.width;
            const filename = `imageway/${hash(output.data)}.${format}`;
            const ref = this.emitFile({ type: 'asset', fileName: filename, source: output.data });
            const token = `__IMAGEWAY_${tokenUrls.size}__`;
            tokenUrls.set(token, `import.meta.ROLLUP_FILE_URL_${ref}`);
            url = options.publicBase ? `${options.publicBase.replace(/\/$/, '')}/${filename}` : token;
          }
          outputs.push({ format, width: outputWidth, height, url });
      }));
      outputs.sort((a, b) => a.width - b.width);
      while (jobs.size > 2048) jobs.delete(jobs.keys().next().value!);
      if (!outputs.length) throw new ImagewayError('VARIANTS', 'No supported image variants generated.');
      const fallbackFormat = formats.includes('jpeg') ? 'jpeg' : formats.includes('png') ? 'png' : formats.includes('gif') ? 'gif' : formats.at(-1)!;
      const fallbacks = outputs.filter(v => v.format === fallbackFormat);
      const fallback = fallbacks.at(-1)!;
      const artifact: ImageArtifact = {
        src: fallback.url,
        srcset: fallbacks.map(v => `${v.url} ${v.width}w`).join(', '),
        sources: formats.filter(v => v !== fallbackFormat).map(format => ({ type: mimeType(format), srcset: outputs.filter(v => v.format === format).map(v => `${v.url} ${v.width}w`).join(', ') })),
        width: fallback.width, height: fallback.height, aspectRatio: fallback.width / fallback.height,
        ...await placeholder(source, directives.placeholder), hash: hash(source),
      };
      options.onProgress?.({ file: relative(vite.root, file), variants: outputs.length });
      // Replace references inside srcsets too; JSON escaping must not turn asset expressions into strings.
      let expression = JSON.stringify(artifact);
      for (const [token, ref] of tokenUrls) expression = expression.replaceAll(token, `" + ${ref} + "`);
      return { code: `export default ${expression};`, map: { mappings: '' } };
    },
  };
}

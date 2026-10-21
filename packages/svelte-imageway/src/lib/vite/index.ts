import { publishAssets, publicAssetBase, type PublishOptions } from '../publish/index.js';
import { PIPELINE_REVISION } from '../version.js';
import type { Plugin, ResolvedConfig } from 'vite';
import { relative, join } from 'node:path';
import { realpath } from 'node:fs/promises';
import { defineConfig } from '../core/config.js';
import { ImagewayError } from '../core/errors.js';
import { mimeType } from '../core/accept.js';
import type {
  ImageArtifact,
  ImageConfig,
  ImageRequest,
  OutputFormat,
  ImageProvider,
} from '../core/types.js';
import { hash } from '../node/cache.js';
import { readLocal } from '../node/source.js';
import { loadSharp, sniff } from '../node/pipeline.js';
import { ImageProcessor } from '../node/processor.js';
import { optimize } from 'svgo';
import { parseDirectives } from './directives.js';
import { placeholder } from './placeholder.js';
import { vercel } from '../providers/vercel.js';
import { netlify } from '../providers/netlify.js';
import { cloudflare } from '../providers/cloudflare.js';
import { generateImageTypes } from './typegen.js';
export { generateImageTypes } from './typegen.js';

export { parseDirectives } from './directives.js';
export interface ImagePluginOptions {
  /** Omit dominated default AVIF sources. Explicit format directives stay exact. Build only; default true. */
  pruneLargerFormats?: boolean;
  config?: Partial<ImageConfig>;
  concurrency?: number;
  publicBase?: string;
  publish?: PublishOptions;
  /** Optional notification, never called for every progress tick. */
  onProgress?: (result: { file: string; variants: number }) => void;
}
/** Typed responsive imports with lazy dev endpoints and persistent content-addressed builds. */
export function imageway(options: ImagePluginOptions = {}): Plugin {
  let config = defineConfig(options.config);
  const publicBase =
    options.publish && !options.publish.dryRun
      ? publicAssetBase(options.publish.publicBase)
      : options.publicBase
        ? publicAssetBase(options.publicBase)
        : undefined;
  let vite: ResolvedConfig;
  const jobs = new Map<
    string,
    { file: string; run: () => Promise<Buffer>; format: OutputFormat }
  >();
  return {
    name: 'svelte-imageway',
    enforce: 'pre',
    api: {
      setTarget(target: string) {
        if (
          ['cloudflare', 'vercel', 'netlify', 'deno'].includes(target) &&
          config.provider?.name === 'local'
        )
          throw new ImagewayError(
            'ADAPTER_PROVIDER',
            'Choose a native or Edge provider for this deployment target.',
          );
        if (!config.provider && !config.providers) {
          const native =
            target === 'vercel'
              ? vercel()
              : target === 'netlify'
                ? netlify()
                : target === 'cloudflare'
                  ? cloudflare()
                  : undefined;
          if (native) config = defineConfig({ ...config, provider: native });
        }
      },
    },
    config: () => ({ ssr: { external: ['svelte-imageway/kit', 'svelte-imageway/node'] } }),
    resolveId(id) {
      if (id === 'virtual:imageway/config') return '\0imageway:config';
    },
    async configResolved(resolved) {
      vite = resolved;
      await generateImageTypes(vite.root);
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const job = jobs.get((req.url ?? '').split('?')[0]!);
        if (!job) return next();
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          res.statusCode = 405;
          res.end();
          return;
        }
        void job
          .run()
          .then((data) => {
            res.setHeader('Content-Type', mimeType(job.format));
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.end(req.method === 'HEAD' ? undefined : data);
          })
          .catch((error) => {
            res.statusCode = error instanceof ImagewayError ? error.status : 500;
            res.end('Image processing failed. Check the configured codec and source limits.');
          });
      });
    },
    async handleHotUpdate(ctx) {
      if (/\.(svelte|[jt]s)$/.test(ctx.file)) await generateImageTypes(vite.root);
      // Old URLs are content-addressed and may remain in already-rendered pages; bound their retention.
      if (jobs.size > 2048)
        for (const [key, job] of jobs) if (job.file === ctx.file) jobs.delete(key);
    },
    async generateBundle(_output, bundle) {
      if (!options.publish || vite.build.ssr) return;
      const assets = Object.values(bundle).filter(
        (v) => v.type === 'asset' && /^imageway\/[a-f0-9]{64}\./.test(v.fileName),
      );
      const result = await publishAssets(
        assets.map((v) => {
          if (v.type !== 'asset') throw new Error('Expected asset.');
          return {
            key: v.fileName,
            bytes: typeof v.source === 'string' ? new TextEncoder().encode(v.source) : v.source,
            contentType: mimeType(v.fileName.split('.').at(-1) as OutputFormat),
          };
        }),
        options.publish,
      );
      this.emitFile({
        type: 'asset',
        fileName: 'image-manifest.json',
        source: JSON.stringify(result.manifest, null, 2),
      });
    },
    async load(id) {
      if (id === '\0imageway:config') {
        const entries = Object.entries(
          config.providers ?? (config.provider ? { '*': config.provider } : {}),
        );
        const imports: string[] = [],
          values: string[] = [];
        const allowed = new Set([
          'local',
          'edge',
          'generic',
          'cloudflare',
          'vercel',
          'netlify',
          'bunny',
          'imgix',
          'cloudinary',
          'imagekit',
          'imgproxy',
          'ipx',
          'supabase',
          'fastly',
          'cloudfront',
          'uploadcare',
          'cms',
        ]);
        for (const [index, [domain, value]] of entries.entries()) {
          const descriptor = (
            value as ImageProvider & {
              descriptor?: { factory: string; options: Record<string, unknown> };
            }
          ).descriptor;
          if (!descriptor || !allowed.has(descriptor.factory))
            throw new ImagewayError(
              'PROVIDER_SERIALIZATION',
              'A browser provider needs a supported public descriptor; use generic() or an explicit subtree provider.',
            );
          imports.push(
            `import { ${descriptor.factory} as p${index} } from 'svelte-imageway/providers/${descriptor.factory}';`,
          );
          values.push(`${JSON.stringify(domain)}:p${index}(${JSON.stringify(descriptor.options)})`);
        }
        return `${imports.join('\n')}\nexport const config={widths:${JSON.stringify(config.widths)},quality:${config.quality},formats:${JSON.stringify(options.config?.formats)},providers:{${values.join(',')}}};`;
      }
      const split = id.indexOf('?');
      if (split < 0 || !new URLSearchParams(id.slice(split + 1)).has('img')) return;
      const file = id.slice(0, split);
      this.addWatchFile(file);
      // Vite may canonicalize a Windows 8.3/temp alias between builds. Compare
      // physical paths on both sides; readLocal still rejects escaping sources.
      const [sourceRoot, sourceFile] = await Promise.all([realpath(vite.root), realpath(file)]);
      const source = await readLocal(
        relative(sourceRoot, sourceFile).replaceAll('\\', '/'),
        sourceRoot,
        config.maxInputBytes,
      );
      const kind = sniff(source);
      const sharp = await loadSharp();
      const metadata = await sharp(source, { limitInputPixels: config.maxPixels }).metadata();
      const dimensions = metadata.autoOrient;
      const directives = parseDirectives(id.slice(split + 1), dimensions.width, config);
      const formats = [...directives.formats];
      if ((metadata.pages ?? 1) > 1 && directives.transforms.animation !== 'first') {
        for (let i = formats.length - 1; i >= 0; i--)
          if (!['webp', 'gif'].includes(formats[i]!)) formats.splice(i, 1);
        if (!formats.length) formats.push('webp');
      }
      if (metadata.hasAlpha && !formats.includes('png') && formats.includes('jpeg'))
        formats.splice(formats.indexOf('jpeg'), 1, 'png');
      const tokenUrls = new Map<string, string>();
      let outputs: Array<{
        format: OutputFormat;
        width: number;
        height: number;
        url: string;
        data?: Buffer;
        requestedWidth: number;
      }> = [];
      const exactConfig = defineConfig({
        ...config,
        widths: directives.widths,
        qualities: [directives.quality],
        quality: directives.quality,
      });
      const exactProcessor = new ImageProcessor({
        directory: join(vite.root, 'node_modules/.cache/svelte-imageway'),
        config: exactConfig,
        concurrency: options.concurrency,
      });
      const variants = formats.flatMap((format) =>
        (format === 'svg' ? [dimensions.width] : directives.widths).map((width) => ({
          format,
          width,
        })),
      );
      await Promise.all(
        variants.map(async ({ format, width }) => {
          const request: ImageRequest = {
            key: 'import',
            ...directives.transforms,
            w: width,
            q: directives.quality,
          };
          // Exact requested widths/qualities belong to build configuration, not dynamic URL ladders.
          const digest = hash(
            `${hash(source)}:${JSON.stringify(request)}:${format}:${PIPELINE_REVISION}:${JSON.stringify(sharp.versions)}`,
          );
          let url = '';
          let data: Buffer | undefined;
          const run = async () => {
            if (format !== 'svg')
              return exactProcessor.process(source, request, format, undefined, false);
            if (kind !== 'svg')
              throw new ImagewayError('SVG', 'Only approved SVG inputs can produce SVG output.');
            const optimized = optimize(source.toString('utf8'), { multipass: true }).data;
            if (Buffer.byteLength(optimized) > config.maxOutputBytes)
              throw new ImagewayError(
                'OUTPUT_SIZE',
                'Encoded output exceeds configured byte limit.',
                413,
              );
            sniff(Buffer.from(optimized));
            return {
              data: Buffer.from(optimized),
              width: dimensions.width,
              height: dimensions.height,
            };
          };
          let outputWidth = width;
          let height = Math.max(
            1,
            Math.round(directives.transforms.h ?? (dimensions.height * width) / dimensions.width),
          );
          if (vite.command === 'serve') {
            url = `${vite.base}@imageway/${digest}.${format}`;
            jobs.set(url, { file, format, run: async () => (await run()).data });
          } else {
            const output = await run();
            height = output.height;
            outputWidth = output.width;
            data = output.data;
          }
          outputs.push({ format, width: outputWidth, height, url, data, requestedWidth: width });
        }),
      );
      outputs.sort((a, b) => a.width - b.width || a.requestedWidth - b.requestedWidth);
      // A fixed height/inside fit may collapse several requested widths to one
      // encoded width. Repeated width descriptors are invalid in a srcset.
      const seenWidths = new Set<string>();
      outputs = outputs.filter((output) => {
        const key = `${output.format}:${output.width}`;
        if (seenWidths.has(key)) return false;
        seenWidths.add(key);
        return true;
      });
      if (
        vite.command !== 'serve' &&
        options.pruneLargerFormats !== false &&
        !new URLSearchParams(id.slice(split + 1)).has('format')
      ) {
        const avif = outputs.filter((v) => v.format === 'avif');
        if (
          avif.length &&
          avif.every((a) =>
            outputs.some(
              (b) =>
                b.format === 'webp' &&
                b.width === a.width &&
                b.height === a.height &&
                b.data!.length <= a.data!.length,
            ),
          )
        ) {
          outputs = outputs.filter((v) => v.format !== 'avif');
          formats.splice(formats.indexOf('avif'), 1);
        }
      }
      if (vite.command !== 'serve')
        for (const output of outputs) {
          const filename = `imageway/${hash(output.data!)}.${output.format}`;
          const ref = this.emitFile({ type: 'asset', fileName: filename, source: output.data! });
          const token = `__IMAGEWAY_${tokenUrls.size}__`;
          tokenUrls.set(token, `import.meta.ROLLUP_FILE_URL_${ref}`);
          output.url = publicBase ? `${publicBase}/${filename}` : token;
        }
      while (jobs.size > 2048) jobs.delete(jobs.keys().next().value!);
      if (!outputs.length)
        throw new ImagewayError('VARIANTS', 'No supported image variants generated.');
      const fallbackFormat = formats.includes('jpeg')
        ? 'jpeg'
        : formats.includes('png')
          ? 'png'
          : formats.includes('gif')
            ? 'gif'
            : formats.at(-1)!;
      const fallbacks = outputs.filter((v) => v.format === fallbackFormat);
      const fallback = fallbacks.at(-1)!;
      const artifact: ImageArtifact = {
        src: fallback.url,
        srcset: fallbacks.map((v) => `${v.url} ${v.width}w`).join(', '),
        sources: formats
          .filter((v) => v !== fallbackFormat)
          .map((format) => ({
            type: mimeType(format),
            srcset: outputs
              .filter((v) => v.format === format)
              .map((v) => `${v.url} ${v.width}w`)
              .join(', '),
          })),
        width: fallback.width,
        height: fallback.height,
        aspectRatio: fallback.width / fallback.height,
        ...(await placeholder(source, directives.placeholder, config)),
        hash: hash(source),
      };
      options.onProgress?.({ file: relative(vite.root, file), variants: outputs.length });
      // Replace references inside srcsets too; JSON escaping must not turn asset expressions into strings.
      let expression = JSON.stringify(artifact);
      for (const [token, ref] of tokenUrls)
        expression = expression.replaceAll(token, `" + ${ref} + "`);
      return { code: `export default ${expression};`, map: { mappings: '' } };
    },
  };
}

import { publishAssets, publicAssetBase, type PublishOptions } from '../publish/index.js';
import { PIPELINE_REVISION } from '../version.js';
import type { Plugin, ResolvedConfig } from 'vite';
import { relative, join, isAbsolute } from 'node:path';
import { realpath } from 'node:fs/promises';
import { availableParallelism } from 'node:os';
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
import { parseDirectives } from './directives.js';
import { placeholder } from './placeholder.js';
import { PreviewCache } from './preview-cache.js';
import { vercel } from '../providers/vercel.js';
import { netlify } from '../providers/netlify.js';
import { cloudflare } from '../providers/cloudflare.js';

export { parseDirectives } from './directives.js';
export interface ImagePluginOptions {
  /** Optimize ordinary raster imports while preserving their original URL string. Default true. */
  autoImports?: boolean;
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
  let previews: PreviewCache;
  const jobs = new Map<string, { file: string; run: () => Promise<Buffer>; contentType: string }>();
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
    configResolved(resolved) {
      vite = resolved;
      previews = new PreviewCache(join(vite.root, 'node_modules/.cache/svelte-imageway-previews'));
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
            res.setHeader('Content-Type', job.contentType);
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
    handleHotUpdate(ctx) {
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
      const file = split < 0 ? id : id.slice(0, split);
      const query = split < 0 ? '' : id.slice(split + 1);
      const params = new URLSearchParams(query);
      const explicit = params.has('img');
      const automatic =
        options.autoImports !== false &&
        !id.startsWith('\0') &&
        isAbsolute(file) &&
        !file.replaceAll('\\', '/').split('/').includes('node_modules') &&
        /\.(?:jpe?g|png|webp|avif|gif|tiff?)$/i.test(file) &&
        [...params.keys()].every((key) => ['import', 't', 'v'].includes(key));
      if (!explicit && !automatic) return;
      // Vite may canonicalize a Windows 8.3/temp alias between builds. Compare
      // physical paths before testing automatic-import containment too; readLocal
      // still rejects explicitly requested imports escaping the source root.
      const [sourceRoot, sourceFile] = await Promise.all([realpath(vite.root), realpath(file)]);
      const local = relative(sourceRoot, sourceFile).replaceAll('\\', '/');
      if (
        !explicit &&
        (local === '..' ||
          local.startsWith('../') ||
          isAbsolute(local) ||
          local.split('/').includes('node_modules'))
      )
        return;
      this.addWatchFile(file);
      const source = await readLocal(local, sourceRoot, config.maxInputBytes);
      const kind = sniff(source);
      const sharp = await loadSharp(kind);
      const metadata = await sharp(source, { limitInputPixels: config.maxPixels }).metadata();
      const dimensions = metadata.autoOrient;
      const directives = parseDirectives(query, dimensions.width, config);
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
        concurrency:
          options.concurrency ??
          (vite.command === 'build'
            ? Math.max(1, Math.min(4, availableParallelism() - 1))
            : undefined),
        build: vite.command === 'build',
      });
      const preparedSource = exactProcessor.prepare(source);
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
            `${preparedSource.digest}:${JSON.stringify(request)}:${format}:${PIPELINE_REVISION}:${JSON.stringify(sharp.versions)}`,
          );
          let url = '';
          let data: Buffer | undefined;
          const run = async () => {
            if (format !== 'svg') return preparedSource.process(request, format, undefined, false);
            if (kind !== 'svg')
              throw new ImagewayError('SVG', 'Only approved SVG inputs can produce SVG output.');
            const { optimize } = await import('svgo');
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
            jobs.set(url, {
              file,
              contentType: mimeType(format),
              run: async () => (await run()).data,
            });
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
        !params.has('format')
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
      const nativeOutputs = outputs.some((v) => v.format === 'webp')
        ? outputs.filter((v) => v.format === 'webp')
        : fallbacks;
      const native = nativeOutputs.at(-1)!;
      const artifact: ImageArtifact = {
        img:
          native.format === fallbackFormat
            ? undefined
            : {
                src: native.url,
                srcset: nativeOutputs.map((v) => `${v.url} ${v.width}w`).join(', '),
                width: native.width,
                height: native.height,
                type: mimeType(native.format),
              },
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
        ...(await previews.resolve(
          preparedSource.digest,
          directives.placeholder,
          config,
          sharp.versions,
          () => placeholder(source, directives.placeholder, config),
        )),
        hash: preparedSource.digest,
      };
      options.onProgress?.({ file: relative(vite.root, file), variants: outputs.length });
      // Replace references inside srcsets too; JSON escaping must not turn asset expressions into strings.
      let expression = JSON.stringify(artifact);
      for (const [token, ref] of tokenUrls)
        // A string replacement interprets $$ as $, corrupting valid Rolldown references.
        expression = expression.replaceAll(token, () => `" + ${ref} + "`);
      let code = `export default ${expression};`;
      if (automatic && !explicit) {
        // The URL remains an original-file URL for native img/CSS consumers. Only
        // Imageway components resolve its build-generated responsive metadata.
        const policy = JSON.stringify({
          config: exactConfig,
          placeholder: directives.placeholder,
          prune: options.pruneLargerFormats,
        });
        const digest = hash(`${preparedSource.digest}:${policy}:${PIPELINE_REVISION}`);
        const extension = kind;
        let original: string;
        if (vite.command === 'serve') {
          const url = `${vite.base}@imageway/${digest}.${extension}`;
          jobs.set(url, { file, contentType: `image/${kind}`, run: async () => source });
          original = JSON.stringify(url);
        } else {
          const filename = `imageway/${digest}.${extension}`;
          const ref = this.emitFile({ type: 'asset', fileName: filename, source });
          original = publicBase
            ? JSON.stringify(`${publicBase}/${filename}`)
            : `import.meta.ROLLUP_FILE_URL_${ref}`;
        }
        const registration = hash(
          `${vite.root}:${sourceFile}:${JSON.stringify(config)}:${publicBase ?? ''}:${PIPELINE_REVISION}`,
        );
        code = `import { registerImageArtifact as register } from 'svelte-imageway/core';\nconst original=${original};\nregister(original,${expression},${JSON.stringify(registration)});\nexport default original;`;
      }
      while (jobs.size > 2048) jobs.delete(jobs.keys().next().value!);
      return { code, map: { mappings: '' } };
    },
  };
}

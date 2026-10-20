# svelte-imageway

Responsive images for Svelte 5: optimize local imports, switch image providers, or run your own image service with the same components.

**0.1.0 preview.** Local builds, components, runtime services and CLI are implemented and tested. The original 1.0 acceptance targets are still open: the full Image entry exceeds 1.5 KiB gzip and cold builds are slower than vite-imagetools. See [REPORT.md](REPORT.md).

## Before → after

```svelte
<!-- Before: one full-size download, no reserved dimensions -->
<img src="/hero.jpg" alt="A mountain trail" />
```

```svelte
<script lang="ts">
  import { Image } from 'svelte-imageway';
  import hero from './hero.jpg?img';
</script>

<Image src={hero} alt="A mountain trail" priority sizes="100vw" />
```

Imageway generates responsive AVIF/WebP/fallback assets, reserves dimensions and adds a small preview. `priority` adds eager loading, high fetch priority and an image preload. `alt` is required; use `alt=""` for decorative images. Without `priority`, images load lazily.

## Start in three steps

### 1. Install

Install the preview in your existing Svelte 5 / Vite 8 project:

```sh
bun add svelte-imageway@next
```

The preview uses the `next` tag. Source code and downloadable archives are available on [GitHub](https://github.com/snowly14/svelte-imageway).

Use Node 22.17+ or Node 24 LTS. Sharp is optional at installation but required for local processing; managed providers can run without it. SvelteKit integration targets Kit 3. This preview does not claim Kit 2 compatibility.

### 2. Add the Vite plugin

Preserve the adapter and existing options in your Vite config:

```ts
// vite.config.ts — SvelteKit 3
import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { imageway } from 'svelte-imageway/vite';

export default defineConfig({
  plugins: [imageway(), sveltekit()],
});
```

For plain Svelte/Vite, use `svelte()` in place of `sveltekit()`. Add this reference to `src/app.d.ts` (or your Vite environment declaration):

```ts
/// <reference types="svelte-imageway/types" />
```

### 3. Import and render

Use the component example above and start your existing dev script with `bun run dev`. Local imports require no account or configuration file. `bun x svelte-imageway init` can prepare the plugin, types and example in a supported literal Vite config.

Custom imports are supported:

```ts
import hero from './hero.jpg?img&w=400;800;1200&format=avif;webp;jpg&q=75&placeholder=lqip';
```

The artifact contains `src`, `srcset`, `sources`, `width`, `height`, `aspectRatio` and optional preview data. Run dev/build after adding directive combinations to generate exact TypeScript declarations. Dev transforms run on demand; builds use a persistent disk cache and bounded reusable workers. Build assets have content hashes and can use immutable CDN caching.

## Components and headless API

| Export                | Purpose                                                                            |
| --------------------- | ---------------------------------------------------------------------------------- |
| `Image`               | Responsive image, required alt, dimensions, preview, preload and native attributes |
| `Picture`             | Multiple formats, art direction, media sources and snippets                        |
| `BackgroundImage`     | Responsive CSS backgrounds with a fallback                                         |
| `ImageMeta`           | OG, Twitter and image metadata                                                     |
| `ImageConfigProvider` | Configuration for a component subtree                                              |
| `getImageProps`       | Image attributes for your own markup; also available from `/props`                 |

`Image` forwards HTML attributes and `onload`/`onerror`; loading/error snippets are available. Reduced-motion users skip the reveal animation. Dimensions and previews work in SSR and without JavaScript. For a URL string, supply intrinsic `width` and `height` from your CMS or application.

## Change providers in configuration

```ts
// svelte-imageway.config.ts
import { defineConfig } from 'svelte-imageway/config';
import { cloudinary } from 'svelte-imageway/providers/cloudinary';

export default defineConfig({
  provider: cloudinary({ cloudName: 'your-public-cloud' }),
});
```

Import this object into Vite and pass `imageway({ config })`. Components using source strings stay the same when the configured provider changes; local import artifacts continue to reference their generated assets. Domain maps and subtree overrides are supported. Only transforms supported by the selected provider are portable; unsupported operations fail explicitly.

Providers: local, edge, generic URL templates, Cloudflare, Vercel, Netlify, Bunny, imgix, Cloudinary, ImageKit, imgproxy, IPX, Supabase, Fastly, CloudFront and Uploadcare. Import a factory from `svelte-imageway/providers/<name>`. CMS helpers cover Sanity, Contentful, Directus, Storyblok, Prismic, DatoCMS, Shopify and Unsplash; Strapi/WordPress use their pre-generated variants.

Imageway supplies integrations, **not an included global CDN**. Accounts, object storage, provider entitlements and delivery charges belong to your deployment. Public provider URL conformance is tested; paid cloud deployments and real storage uploads have not been executed.

## Runtime and publication

- **SvelteKit Node/Bun:** `imageHandle` / `createImageService` from `/kit`, with an explicit source root and origin allowlist. Arbitrary transforms require server signatures; unsigned locked presets are supported. Responses default to private caching.
- **Cloudflare Worker:** `/edge` with Images, R2 and a Durable Object budget guard. Local Wrangler bindings are exercised. An actual cloud deployment remains unverified; no WASM fallback is shipped.
- **Standalone:** Node/Bun and hardened Docker Compose examples are included in the repository.
- **Static builds:** `/publish` uploads content-addressed variants through a `StorageTarget` and rewrites image artifact URLs. S3/R2/B2, Bunny Storage, Vercel Blob and Supabase targets use optional SDKs where needed. Dry-run, resume and conservative GC are supported.

`imageAdapter` from `/kit` wraps official adapters while preserving their hooks. Node/static apps are built and served locally; Cloudflare/Vercel/Netlify wrappers are constructed and type-checked. Native provider and runtime restrictions are documented in the guides.

## CLI

```sh
bun x svelte-imageway init
bun x svelte-imageway optimize ./images --format webp --width 960
bun x svelte-imageway audit ./src --json
bun x svelte-imageway deploy cloudflare --dry-run
bun x svelte-imageway migrate ./src --from enhanced-img
```

These commands use the installed package CLI. `optimize` preserves originals and supports dry-run/watch. Audit findings exit 1; command errors exit 2. Deploy generates configuration and instructions; it does not create paid resources. Migration previews changes and backs up writes; unsupported patterns require review. Protected Worker purge requires an environment token and `--yes`.

## Measurements and limits

Measured on an Apple M4, Node 24.22.0, using three original synthetic 1200×800 images; medians of three runs. These are small reproducible fixtures, not a photographic quality study.

| Build, 18 variants |   Cold | Disk cache warm |
| ------------------ | -----: | --------------: |
| Imageway           | 275 ms |           50 ms |
| vite-imagetools    | 144 ms |           39 ms |
| enhanced-img       | 139 ms |           40 ms |

For small trusted build inputs, `imageway({ concurrency: 4 })` measured about 221 ms cold in a separate three-run sweep. The default remains two workers. More workers increase concurrent decoder memory; tune against your own input set and memory limit. These local measurements do not establish market-wide performance leadership.

Median source-to-output reduction was 92% across six WebP/AVIF outputs at width 960, quality 75; both resizing and re-encoding contribute. Encoder defaults differ between tools, so equal quality numbers do not imply equal perceptual quality. [Protocol and raw measurements](bench/README.md).

JPEG/PNG/WebP/AVIF/TIFF/GIF and a restricted geometric SVG dialect are exercised. EXIF orientation is applied and GPS removed by default; ICC retention is optional. HEIC/JXL depend on the installed codecs. BMP/ICO, animated AVIF/video and rich SVG are unsupported. The base component currently exceeds the requested 1.5 KiB gzip target. Provider-specific advanced transforms and paid runtime behavior need deployment-specific validation.

The service enforces source policy, DNS pinning, signatures, pixel/frame/byte/time limits and bounded admission. Signed URLs do not automatically make mutable sources immutable. A request budget is not an account spending cap. Read [SECURITY.md](SECURITY.md) before exposing a service.

## Repository development

```sh
bun install
bun run check
bun run build:components
bun run test:e2e
```

Service E2E additionally needs the documented local Worker and Docker fixtures. Core coverage exceeds 90%; SSR, Chromium/WebKit and Linux Firefox checks are recorded in [REPORT.md](REPORT.md). CI configuration is not evidence of a completed remote CI run.

The documentation website is deferred at the user's request and preserved in `extras/docs-preview`; it is excluded from the active workspace. The README and package are the current focus.

[Local images](docs/guides/local-images.md) · [Remote/CMS](docs/guides/remote-and-cms.md) · [Runtime](docs/guides/adapters-and-runtime.md) · [CLI](docs/guides/cli.md) · [Publication](docs/guides/publication.md) · [CDN topology and costs](docs/research/platforms-and-costs.md) · [Architecture](docs/adr/0001-architecture.md)

MIT — [LICENSE](LICENSE).

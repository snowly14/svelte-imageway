# svelte-imageway

Responsive images for Svelte 5: optimize local imports, switch image providers, or run your own image service with the same components.

**1.5.0.** Hybrid image delivery: build local assets ahead of time, negotiate dynamic formats at supported endpoints, and preserve explicit control. The original performance stretch targets remain open: the Image entry exceeds 1.5 KiB gzip and cold-build parity with vite-imagetools has not been established. Version numbering does not imply those benchmark targets were met. See [REPORT.md](https://github.com/snowly14/svelte-imageway/blob/main/REPORT.md).

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

Finite build batches are scheduled separately from runtime request admission, so waiting for other variants does not consume an individual transform deadline. Per-transform decoding limits and runtime request limits remain enforced.

## Lightweight local images

Use `StaticImage` when `src` is a generated `?img` artifact and you do not need providers, custom source/snippet slots, transitions or the headless API:

```svelte
<script lang="ts">
  import StaticImage from 'svelte-imageway/static';
  import hero from './hero.jpg?img';
</script>

<StaticImage src={hero} alt="A mountain trail" priority sizes="100vw" />
```

The measured StaticImage entry is 1,196 bytes gzip with the Svelte peer externalized; the complete Image entry remains 3,158 bytes. These are different capability sets, not a like-for-like speed comparison. StaticImage preserves responsive sources, dimensions, loading, preview removal, native events and matching priority preloads. It requires ImageArtifact and an explicit alt; dynamic strings use Image with a configured provider. It does not support Image's custom loading/error snippets or source slots. Set display size through CSS and `sizes`; artifact dimensions remain authoritative.

Default build imports now omit AVIF only when **every** matching WebP width/height has no more bytes. This can avoid downloading a larger AVIF simply because the browser supports it. It compares encoded bytes at the configured encoder settings, not perceptual quality; both encodings are still computed to make the decision. Explicit `format=` directives remain exact. Set `imageway({ pruneLargerFormats: false })` to preserve all default formats. Development remains lazy and does not perform this build-only comparison.

## Intelligent delivery in 1.2

- Local `?img` imports generate static responsive files. Automatic widths omit near-duplicate final sizes (less than 25% apart), preserving the largest and smallest widths. Explicit `w=` values remain exact.
- Dynamic strings use your configured provider. Node/Kit and Edge providers now negotiate formats using the browser's `Accept` header by default. Their responses vary on `Accept, Save-Data`; configure any intermediate CDN to honor these headers. This avoids listing each format in HTML and lets the endpoint cache the requested representation. It does not create an endpoint automatically.
- Imported artifacts retain `<picture>` sources. Without format sources or a custom source snippet, `Image` renders a plain `<img>`.
- Set `formatStrategy="picture"` on `Image` (or in `ImageConfigProvider`) to force explicit provider sources. A configured format allowlist also retains explicit formats. Other providers keep their capability-specific behavior.
- Quality remains a deliberate encoder setting (75 by default), not an unverified perceptual quality algorithm. Originals remain untouched.

Generate custom query declarations before type checking, without starting Vite:

```sh
bun x svelte-imageway typegen
```

For CI, run type generation before your application's check script. Keep the `svelte-imageway/types` reference below for standard `?img` imports, including newly added imports before the dev server runs. Generated imports are `ImageArtifact`, never `any`; Vite validates actual source existence at build time.

## Start in three steps

### 1. Install

Install the package in your existing Svelte 5 / Vite 8 project:

```sh
bun add svelte-imageway@1.5.0
```

Releases use the `latest` tag. Source code and downloadable archives are available on [GitHub](https://github.com/snowly14/svelte-imageway).

Use Node 22.17+ or Node 24 LTS. Sharp is optional at installation but required for local processing; managed providers can run without it. SvelteKit integration targets Kit 3. Kit 2 compatibility is not claimed.

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
bun x svelte-imageway codecs --json
bun x svelte-imageway audit ./src --json
bun x svelte-imageway deploy cloudflare --dry-run
bun x svelte-imageway migrate ./src --from enhanced-img
```

These commands use the installed package CLI. `optimize` preserves originals and supports dry-run/watch. Audit findings exit 1; command errors exit 2. Deploy generates configuration and instructions; it does not create paid resources. Migration previews changes and backs up writes; unsupported patterns require review. Protected Worker purge requires an environment token and `--yes`.

## Measurements and limits

Measured on 21 October 2026, Apple M4, Node 26.11.1: seven alternating 1.4.0/current pairs, fresh Node processes, identical encoded outputs. Synthetic fixtures are not a photographic quality study.

| Prepared memory-cache lookup | Output bytes | 1.4.0 ops/s | 1.5.0 ops/s | Ratio |
| ---------------------------- | -----------: | ----------: | ----------: | ----: |
| Small synthetic WebP         |        1,580 |      14,733 |      26,681 | 1.81× |
| Synthetic texture WebP       |      155,112 |       5,048 |      10,478 | 2.08× |
| Synthetic landscape PNG      |      246,641 |       3,209 |       6,609 | 2.06× |

| HTTP median      |          1.4.0 |          1.5.0 |
| ---------------- | -------------: | -------------: |
| Cold TTFB        |      69.056 ms |      69.295 ms |
| Warm TTFB        |       0.269 ms |       0.256 ms |
| Burst throughput | 8389.203 req/s | 9344.921 req/s |
| Peak RSS         |    147.594 MiB |    148.344 MiB |

The processor table measures prepared memory-cache hits, excluding native encoding and warm-up; it is not HTTP or codec throughput. The final HTTP burst median is 11.4% higher; cold TTFB is essentially unchanged. Host load is uncontrolled and an earlier noisier trial plus a same-code A/A control are retained in [all samples and protocols](https://github.com/snowly14/svelte-imageway/blob/main/bench/README.md). No market-wide or statistical superiority claim is made. Encoder settings and encoded bytes are unchanged. StaticImage remains 1196 gzip bytes; full Image 3158, Svelte externalized.

JPEG XL browser support and installed native-codec support are separate. `bun x svelte-imageway codecs --json` reports actual capabilities; standard Sharp binaries in this environment cannot decode/encode JXL. Existing hosted JXL files can be supplied through typed artifacts with generated WebP/JPEG fallbacks. [JPEG XL guide](https://github.com/snowly14/svelte-imageway/blob/main/docs/guides/jpeg-xl.md).

JPEG/PNG/WebP/AVIF/TIFF/GIF and a restricted geometric SVG dialect are exercised. EXIF orientation is applied and GPS removed by default; ICC retention is optional. HEIC/JXL depend on the installed codecs. BMP/ICO, animated AVIF/video and rich SVG are unsupported. The base component currently exceeds the requested 1.5 KiB gzip target. Provider-specific advanced transforms and paid runtime behavior need deployment-specific validation.

The service enforces source policy, DNS pinning, signatures, pixel/frame/byte/time limits and bounded admission. Signed URLs do not automatically make mutable sources immutable. A request budget is not an account spending cap. Read [SECURITY.md](SECURITY.md) before exposing a service.

## Repository development

```sh
bun install
bun run check
bun run build:components
bun run test:e2e
# If another preview uses port 4173:
IMAGEWAY_TEST_PORT=4198 bun run test:e2e
```

Service E2E additionally needs the documented local Worker and Docker fixtures. Core coverage exceeds 90%; SSR, Chromium/WebKit and Linux Firefox checks are recorded in [REPORT.md](https://github.com/snowly14/svelte-imageway/blob/main/REPORT.md). CI configuration is not evidence of a completed remote CI run.

The documentation website is deferred at the user's request and preserved in `extras/docs-preview`; it is excluded from the active workspace. The README and package are the current focus.

[Local images](docs/guides/local-images.md) · [Remote/CMS](docs/guides/remote-and-cms.md) · [Runtime](docs/guides/adapters-and-runtime.md) · [CLI](docs/guides/cli.md) · [Publication](docs/guides/publication.md) · [CDN topology and costs](docs/research/platforms-and-costs.md) · [Architecture](docs/adr/0001-architecture.md)

MIT — [LICENSE](LICENSE).

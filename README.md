# svelte-imageway

Responsive images for **Svelte 5 and SvelteKit**. Import a local image normally, render `Image` or `Picture`, and let the Vite plugin generate responsive assets, dimensions and previews.

```svelte
<script lang="ts">
  import { Image } from 'svelte-imageway';
  import mountain from './mountain.jpg';
</script>

<Image src={mountain} alt="A mountain trail at sunrise" priority sizes="100vw" />
```

Normal imports, required `alt`, useful SSR, and no generated image type file. Original files stay unchanged. Local processing uses Sharp/libvips; bounded Rust/WASM accelerates preview calculations without adding WASM to browser bundles.

[Installation](#installation) · [Image or Picture](#image-or-picture) · [Configuration](#configuration) · [Uploads and remote images](#uploads-and-remote-images) · [Performance](#performance) · [Guides](#guides)

## Installation

```sh
bun add svelte-imageway
```

Requires Node **22.17+**, Svelte **5.57.1+** and Vite **8**. The SvelteKit integration targets **Kit 3.1+**. Rust is not required in consuming projects. Sharp is an optional dependency installed by default; if your installation skips optional dependencies, install `sharp` for local image processing.

Add the plugin to your existing Vite config, keeping your adapter and other options:

```ts
// vite.config.ts — SvelteKit
import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { imageway } from 'svelte-imageway/vite';

export default defineConfig({
  plugins: [imageway(), sveltekit()],
});
```

For plain Svelte/Vite, replace `sveltekit()` with `svelte()` from `@sveltejs/vite-plugin-svelte`. Start your existing app with `bun run dev`; local imports need no account or configuration file.

## Image or Picture

| Component | Generated markup                           | Use it for                                       |
| --------- | ------------------------------------------ | ------------------------------------------------ |
| `Image`   | `<img>`                                    | Responsive widths, previews and priority loading |
| `Picture` | `<picture><source … /><img … /></picture>` | Multiple formats and art direction               |

Both accept the same normal image import. `Image` uses the generated WebP representation when available, otherwise the configured fallback. `Picture` exposes generated format sources so the browser chooses one. Generating several files at build time does **not** make the browser download every file.

```svelte
<script lang="ts">
  import { Picture } from 'svelte-imageway';
  import mountain from './mountain.jpg';
</script>

<Picture src={mountain} alt="A mountain trail" sizes="(min-width: 960px) 960px, 100vw" />
```

- `alt` is required. Use `alt=""` for a decorative image.
- `priority` enables eager loading, high fetch priority and a matching preload. Use it for the likely largest visible image; other images load lazily.
- Local imports supply intrinsic dimensions. For dynamic sources, provide `width` and `height` from your application or CMS.
- Native attributes, `onload` and `onerror` are forwarded. `loadingContent` and `errorContent` accept Svelte snippets; `loading="lazy"` or `"eager"` controls native loading.
- Dimensions, responsive markup and previews work in SSR without JavaScript. Reveal animation respects reduced motion.

```svelte
<Image src={mountain} alt="A mountain trail">
  {#snippet loadingContent()}<span>Loading image…</span>{/snippet}
  {#snippet errorContent()}<span>Image unavailable</span>{/snippet}
</Image>
```

`Picture` also accepts typed `sources` and a `source` snippet for art direction. [Examples and component types](docs/guides/local-images.md).

## What happens to an import?

1. The plugin reads and validates the source and applies orientation.
2. It generates bounded responsive widths and configured formats, plus an optional small preview.
3. Production assets receive content-hashed URLs and are reused through persistent caches. Development encodes variants when requested.
4. The component renders responsive attributes, dimensions and the appropriate loading policy.

The imported value remains a **URL string pointing to the original**. A native `<img src={mountain}>` still serves that original; Imageway components resolve its associated optimized metadata automatically. This explains why the original and optimized files can both appear in a build. There is no `imageway-env.d.ts` or type-generation step.

Use `?url` to bypass local processing, or `imageway({ autoImports: false })` to disable automatic imports. Ordinary SVG icons and dependency assets keep Vite's behavior.

## Configuration

```ts
imageway({
  config: {
    widths: [320, 640, 960, 1280],
    formats: ['avif', 'webp', 'jpeg'],
    quality: 75,
    placeholder: 'lqip',
  },
  concurrency: 2, // optional: bound build workers on a smaller machine
});
```

Quality 75 is the default encoder setting, not a guarantee of equal perceptual quality across codecs. Originals are never overwritten. Transparency can replace a JPEG fallback with PNG; animation handling avoids silently flattening supported animated inputs.

For a WebP-only local workflow, set `formats: ['webp']` to avoid encoding other formats. By default, production builds omit AVIF only when **every matching WebP size is no larger**. Both formats must be encoded before that byte comparison. Explicit format directives stay exact; `pruneLargerFormats: false` retains all default formats.

Local-import preview strategies are `lqip` (default), `color`, `thumbhash`, `blurhash` and `none`. Previews are generated on the build/server side. Rust handles colour histograms, hash projections, and ThumbHash display decoding/PNG assembly in a precompiled, fixed-memory module; Sharp handles image codecs. The browser receives display-ready previews, not a hash decoder or Rust runtime. [Native architecture and contributor steps](CONTRIBUTING.md).

Hash previews include a display-ready data URL as well as the compact hash. That data URL can be larger than LQIP; hash length alone is not the transferred preview size.

When a specific image needs custom settings, advanced imports return a typed `ImageArtifact`:

```ts
import mountain from './mountain.jpg?w=400;800;1200&format=webp&q=80&placeholder=color&img';
```

Directives end in `&img` (or use `?img`) so bundled declarations match them. Normal imports remain the usual starting point. [Supported formats, directives and limits](docs/guides/local-images.md).

## Uploads and remote images

An image uploaded **after deployment** cannot be processed by a completed static build. Configure a runtime optimizer or an external image provider, store the upload, and pass its approved key or URL to the component. A `blob:` URL or arbitrary remote string does not create an optimizer by itself.

For example, select a provider in Vite:

```ts
import { cloudinary } from 'svelte-imageway/providers/cloudinary';

imageway({
  config: { provider: cloudinary({ cloudName: 'your-public-cloud' }) },
});
```

```svelte
<Image src="uploads/mountain.jpg" width={1200} height={800} alt="An uploaded mountain photo" />
```

The provider must be configured in your account. Local import artifacts continue to use their generated assets. Provider factories, CMS helpers, hostname maps and subtree overrides are available; unsupported transforms fail explicitly. Imageway supplies integrations, not an included CDN or storage account. [Providers and CMS](docs/guides/remote-and-cms.md).

For self-hosting, `/kit` exports `imageHandle` and `createImageService`; `/node` exposes `ImageProcessor`, including prepared-source reuse for upload variants. Configure source roots, approved origins and server-side signing before exposing a runtime service. [Runtime setup](docs/guides/adapters-and-runtime.md) · [Security](SECURITY.md).

## Other APIs

| Export or entry            | Purpose                                                 |
| -------------------------- | ------------------------------------------------------- |
| `getImageProps` / `/props` | Responsive attributes for custom markup                 |
| `ImageConfigProvider`      | Configuration for a component subtree                   |
| `BackgroundImage`          | Responsive CSS backgrounds                              |
| `ImageMeta`                | Open Graph, Twitter and image metadata                  |
| `/providers/*`, `/cms`     | Provider URLs and CMS image metadata                    |
| `/publish`                 | Publish immutable build assets through a storage target |
| `/edge`                    | Cloudflare runtime integration with platform bindings   |

CLI tools are included:

```sh
bun x svelte-imageway init
bun x svelte-imageway optimize ./images --format webp --width 960
bun x svelte-imageway codecs --json
bun x svelte-imageway audit ./src --json
```

The CLI can also prepare deployment files and migration previews. It does not provision paid resources automatically. [CLI reference](docs/guides/cli.md) · [Asset publication](docs/guides/publication.md).

## Performance

Measurements include the protocol, machine, medians, dispersion and raw samples. [Latest results and release verification](REPORT.md) · [Reproduction](bench/README.md).

The [3.1.2 comparison](bench/LEAN-PREVIEW-3.1.2.md) measures complete Image/Picture entries at **3012/3160 JavaScript gzip bytes**, with Svelte externalized, plus **220/218 CSS bytes**. The requested **under-2000-byte goal remains unmet**. Real client fixtures including Svelte shrink by **500/462 bytes**; a page using both saves **458 bytes total**, including a two-byte CSS increase. Public APIs and lifecycle behavior are preserved.

In seven alternating local sets, Rust ThumbHash display decoding takes **13.9 µs**, compared with **83.2 µs reference JS / 32.0 µs bounded optimized JS**. Decoding plus a byte-identical PNG takes **25.3 / 110.1 / 40.8 µs** respectively. Complete ThumbHash previews improve only about **2.8%** in that session; LQIP remains effectively unchanged. Already optimized imports also avoid unnecessary provider lookup. The report separates initialization, kernels, complete previews, client assets and process RSS, including small memory/CSS regressions.

The dated [3.1 photographic comparison](bench/IMPROVEMENTS-3.1.md) still trails vite-imagetools/enhanced-img in controlled build latency and cold RSS. Those build/codec/HTTP paths are not rebenchmarked in 3.1.2, and no leadership is claimed.

Paid cloud deployments are unverified. JPEG XL/HEIC support depends on the installed native codecs; use `codecs --json` to check. Rich SVG, video conversion and a browser WASM optimizer are not included. [Format details](docs/guides/local-images.md) · [JPEG XL](docs/guides/jpeg-xl.md).

## Development

```sh
bun install --frozen-lockfile
bun run check
bun run format:check
bun run package:check
bun run check:budget
bun run check:picture-budget
bun run build:components
bun run test:e2e
```

[Contributing and native rebuilds](CONTRIBUTING.md) · [Architecture decisions](docs/adr/0001-architecture.md) · [3.0 migration](docs/guides/migration-3.md) · [Changelog](packages/svelte-imageway/CHANGELOG.md) · [Report an issue](https://github.com/snowly14/svelte-imageway/issues)

MIT — [LICENSE](LICENSE). Third-party algorithm notices ship with the preview artifact.

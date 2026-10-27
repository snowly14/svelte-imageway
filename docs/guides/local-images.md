# Local images and formats

Ordinary raster imports (`import photo from "./photo.jpg"`) remain URL strings and work directly in Image/Picture. The plugin registers responsive metadata automatically, for SSR and the browser, without a generated application type file. Raw native img retains original bytes. SVG icons and node_modules imports are not automatically transformed; `?url` bypasses processing, and `imageway({autoImports:false})` disables automatic imports.

Optional advanced imports return an ImageArtifact: `src`, `srcset`, `sources`, intrinsic width/height/aspectRatio, optional placeholder/dominantColor/hash.

```ts
import hero from './hero.jpg?w=400;800;1200&format=avif;webp;jpg&q=75&placeholder=lqip&img';
```

Widths/qualities on build imports are exact, deduplicated and clamped to intrinsic width. Runtime requests use bounded ladders. Limit one import to 64 variants. Supported placeholder strategies: lqip (default, under 1 KB), color, none, thumbhash, blurhash. Hashes are decoded at build time into a browser-displayable preview; no client decoder is shipped.

Dev transforms are lazy: import metadata first, encode only when the browser requests a variant. Build transforms use a persistent content/codec/policy cache in `node_modules/.cache/svelte-imageway` and shared bounded worker admission. Content-hashed old URLs remain valid during HMR, with bounded retention of dev jobs.

JPEG, PNG, WebP, AVIF, TIFF, approved SVG and GIF inputs are exercised with real fixtures. JPEG uses mozjpeg. Auto orientation removes EXIF/GPS. `metadata=icc` retains ICC without retaining GPS; CMYK is converted for web display. Alpha build inputs replace an unsuitable JPEG fallback with PNG. Animated inputs preserve WebP/GIF, and omit formats whose encoder would silently flatten them. `animation=first` deliberately creates a still. Animated AVIF/video conversion is not implemented.

HEIC/HEIF and JXL depend on the actual Sharp/libvips distribution and fail with an actionable codec error if absent. BMP/ICO and WASM fallback decoders are not implemented in this preview. Inspect `codecCapabilities()` from `svelte-imageway/node`; do not infer codec support from the filename. This limitation remains part of the 1.0 acceptance backlog.

SVG accepts only a small geometric dialect and is validated before SVGO/Sharp. Scripts, references, text, styles and external resources are rejected. For rich illustrations, rasterize with a trusted design tool rather than relaxing the runtime policy.

Finite builds select up to four active transforms from the available CPU parallelism. Since 3.1.8 these transforms share one owned Node worker; Sharp/libvips performs the asynchronous native work. Development serving and direct/runtime processors retain their existing isolated worker pools. More concurrent transforms can still increase native memory use. Constrain builds explicitly on smaller machines:

```ts
imageway({ concurrency: 2 });
```

Each imported source is prepared once for its variants. Encoder settings and pixel/byte limits are preserved. A hard build deadline terminates the shared executor before permitting replacement work and fails the build, including co-located variants. Runtime requests retain their existing failure isolation. [Executor design and fault tests](../adr/0030-private-vite-native-executor.md).

Build previews use the bundled Rust/WebAssembly kernel for dominant-colour histograms. BlurHash projection and ThumbHash LPQA/DCT encoding also use this bounded module; display-preview decoding remains on the server/build side. The fixed 64 KiB kernel validates dimensions (1–32), has no host imports or memory growth, and requires no consumer Rust toolchain. Sharp/libvips still decodes, resizes and encodes image formats. See the current REPORT.md for measured scope and remaining limits.

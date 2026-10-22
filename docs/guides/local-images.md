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

Finite builds in 1.4.0 select one to four workers from the available CPU parallelism. Development/runtime defaults remain unchanged. More workers may increase native memory use. Constrain builds explicitly on smaller machines:

```ts
imageway({ concurrency: 2 });
```

Each imported source is prepared once for its variants. Encoder settings, pixel/byte limits and individual worker deadlines are preserved.

The optional blurhash strategy uses the bundled Rust/WebAssembly 4x3 encoder. The fixed 64 KiB kernel validates dimensions (1–32) and has no host imports or memory growth. Loading is lazy, per build/server module instance; its one-time cost and preview-only benchmarks are reported separately. The default lqip strategy and image codecs do not use this kernel. No Rust toolchain is needed in consuming applications.

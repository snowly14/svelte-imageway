# Local images and formats

Typed imports return an ImageArtifact: `src`, `srcset`, `sources`, intrinsic width/height/aspectRatio, optional placeholder/dominantColor/hash.

```ts
import hero from './hero.jpg?img&w=400;800;1200&format=avif;webp;jpg&q=75&placeholder=lqip';
```

Widths/qualities on build imports are exact, deduplicated and clamped to intrinsic width. Runtime requests use bounded ladders. Limit one import to 64 variants. Supported placeholder strategies: lqip (default, under 1 KB), color, none, thumbhash, blurhash. Hashes are decoded at build time into a browser-displayable preview; no client decoder is shipped.

Dev transforms are lazy: import metadata first, encode only when the browser requests a variant. Build transforms use a persistent content/codec/policy cache in `node_modules/.cache/svelte-imageway` and shared bounded worker admission. Content-hashed old URLs remain valid during HMR, with bounded retention of dev jobs.

JPEG, PNG, WebP, AVIF, TIFF, approved SVG and GIF inputs are exercised with real fixtures. JPEG uses mozjpeg. Auto orientation removes EXIF/GPS. `metadata=icc` retains ICC without retaining GPS; CMYK is converted for web display. Alpha build inputs replace an unsuitable JPEG fallback with PNG. Animated inputs preserve WebP/GIF, and omit formats whose encoder would silently flatten them. `animation=first` deliberately creates a still. Animated AVIF/video conversion is not implemented.

HEIC/HEIF and JXL depend on the actual Sharp/libvips distribution and fail with an actionable codec error if absent. BMP/ICO and WASM fallback decoders are not implemented in this preview. Inspect `codecCapabilities()` from `svelte-imageway/node`; do not infer codec support from the filename. This limitation remains part of the 1.0 acceptance backlog.

SVG accepts only a small geometric dialect and is validated before SVGO/Sharp. Scripts, references, text, styles and external resources are rejected. For rich illustrations, rasterize with a trusted design tool rather than relaxing the runtime policy.

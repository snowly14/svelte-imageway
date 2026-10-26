# svelte-imageway

## 3.1.5

### Patch Changes

- Avoid allocating registration maps for reads of unknown image URLs, skip hostname parsing when no provider map exists and omit empty generated provider maps. Inline the native artifact selection in the attribute helper while keeping the public helper/API unchanged. Preserve complete attributes, provider contracts and SSR/no-JS behavior; component size reductions are small and the 2000-byte target remains unmet.

## 3.1.4

### Patch Changes

- Keep finite-build prepared sources in one private, exact-sized shared backing store across worker variants, reducing redundant input copies while preserving encoded bytes, source ownership, worker limits and runtime admission. Retain measured RSS wins and timing regressions in the benchmark report; the public API, native preview kernel and component sizes remain unchanged.

## 3.1.3

### Patch Changes

- Decode generated BlurHash display previews with the bounded precompiled Rust kernel, preserving exact pixel/WebP output and fixed 64 KiB memory. Validate gamma rounding boundaries, retain exact JS conversion for boundary channels, remove the BlurHash runtime dependency and avoid a redundant preview pixel copy. Public component and provider APIs remain stable.

## 3.1.2

### Patch Changes

- Move bounded ThumbHash display decoding and reference-compatible PNG/checksum assembly into the precompiled Rust kernel, with fixed 64 KiB memory and byte-identical output. Remove the ThumbHash runtime dependency, preserve the public API and trim component derivation and registered-image provider lookup overhead.

## 3.1.1

### Patch Changes

- Disable active reveal animations for reduced-motion users by matching the animated selector's specificity. Cover Image and Picture in the browser regression.

- Reduce Image/Picture client overhead while preserving their markup and lifecycle behavior. Move bounded ThumbHash LPQA/DCT encoding into the precompiled Rust preview kernel with byte-identical reference output, fixed memory and no browser WASM. Rewrite the README around installation, normal imports, component choice, uploads and reproducible performance results.

## 3.1.0

### Minor Changes

- Calculate build-preview dominant colours with a bounded Rust histogram instead of requesting unused Sharp statistics. Keep libvips tie-breaking for ambiguous maxima and overlap WASM initialization with preview decoding. Default LQIP, color, BlurHash and ThumbHash previews use the same 64 KiB precompiled module, with identical image and preview outputs.
- Load SVGO only for SVG output and make default-policy initialization removable from component-only browser bundles. Image/Picture behavior, image codec settings and runtime worker/resource limits are unchanged.
- Reuse bounded persistent preview metadata on warm builds, invalidating on source, strategy, codec or security-policy changes. Regenerate malformed entries and preserve source admission. Trim redundant component derivation and avoid copying resolved artifacts.

## 3.0.1

### Patch Changes

- Preserve consecutive dollar signs in Vite/Rolldown emitted asset references. Avoid interpreting asset identifiers as JavaScript replacement-string patterns, which could otherwise fail production builds for particular image contents. Add a regression test and a photographic benchmark protocol.

## 3.0.0

### Major Changes

- Remove StaticImage, StaticPicture and their subpaths/types; Image and Picture handle both ordinary local imports and dynamic provider URLs. Replace the optional 4x3 BlurHash encoder with a bounded Rust WebAssembly kernel, loaded only during server/build preview processing. The fixed 64 KiB module ships precompiled with verified source/artifact hashes; consumers need no Rust compiler. Native image encoding continues through Sharp/libvips. Document the breaking migration and measured preview-only performance.

## 2.0.0

### Major Changes

- Optimize ordinary local raster imports without query syntax or generated type files, while preserving their original URL-string contract. Image and StaticImage now render img only; use Picture and the new StaticPicture for explicit picture markup. Public declaration entries include the bundled advanced-import types automatically. Remove the obsolete typegen command and generated declarations; advanced artifact imports use ?img or directives ending in &img.

## 1.5.0

### Minor Changes

- Reuse parsed, privately owned memory-cache representations with one defensive output copy per hit, and fingerprint the frozen processing policy once per processor. Add a typed native-codec report and `svelte-imageway codecs --json`. JPEG XL inputs now fail with an actionable codec-unavailable error when the installed Sharp build lacks libjxl; no automatic JXL output or bundled JXL encoder is claimed.

## 1.4.0

### Minor Changes

- Add typed immutable prepared image sources and reuse them in the HTTP service, eliminating repeated source copies and content hashing on cache hits while retaining source expiry and authorization. Finite Vite builds use up to four workers based on available parallelism; the existing concurrency override remains available for memory-constrained builds. Add alternating, byte-verified HTTP comparison benchmarks.

## 1.3.1

- Schedule finite Vite build batches outside runtime request admission, starting each worker deadline only when a bounded build slot is available. This prevents legitimate large variant batches from consuming the request queue's byte/deadline budget. Runtime request limits and individual transformation deadlines are unchanged.

## 1.3.0

- Add StaticImage and the svelte-imageway/static entry for artifact-only delivery, measured separately from the complete Image component.
- Omit default AVIF sources only when all matching WebP sizes are no larger. Preserve explicit format directives and fallback formats; opt out with pruneLargerFormats: false. This is byte selection, not a perceptual quality comparison.
- Transfer exclusively owned worker output allocations and avoid redundant signature/output copies. Keep fallback copies for pooled/partial buffers.
- Canonicalize Vite source/root paths before containment checks, preserving rejection of external sources across Windows aliases.
- Deduplicate actual srcset widths when fixed-height resizing collapses several requested sizes.
- Apply configured byte/pixel/timeout limits to previews and the output byte limit to optimized SVG imports.
- Add alternating baseline/current benchmarks with byte-identical output checks. Make the optional Worker runtime benchmark explicit instead of requiring an undeclared local server.
- Enforce a separate 1536-byte StaticImage budget. The complete Image budget and original unmet performance targets remain distinct.

## 1.2.0

- Prefer server format negotiation for dynamic local/Edge providers; retain explicit picture mode and format allowlists.
- Render a native img without an unnecessary picture wrapper when no sources are needed.
- Avoid nearly identical final default build widths; preserve explicit width directives.
- Generate the baseline type reference consistently and add a standalone typegen CLI command for checks before Vite startup.
- Fix undefined format requests for providers that negotiate formats.
- Publish the reviewed release under latest. Original bundle/build performance stretch targets remain unmet; this release makes no fastest-on-the-market claim.

## 0.1.0

Initial preview published under the `next` dist-tag.

- Responsive Svelte 5 components and typed Vite image imports with persistent caches.
- Shared URL contract, signatures, provider/CMS builders and policy-enforced Node/Bun/Worker services.
- Build publication targets, deployment templates and init/optimize/audit/purge/migrate CLI.
- Strict source/SVG/resource policies, compiled-worker tests and local service/browser verification.

Known acceptance gaps: base Image size, build parity, exact Lighthouse 100 and additional codec/cloud coverage. See the repository report. This preview makes no 1.0 or included-CDN claim.

### Preview hardening before first publication

- Retain Worker transform admission until native encoding settles after a response timeout.
- Include decoder and output policy in Node representation cache identities.
- Apply responsive background variants through the CSS cascade.
- Reject empty memory-cache entries and cap entry count.
- Share disk-cache accounting across processors, serialize writes and amortize directory reconciliation with bounded filesystem concurrency.

- Normalize Windows file URLs and nested source keys, reject cross-drive path escapes, and keep LF checkout consistent across CI runners.
- Preserve transparent backgrounds in the native Worker binding.
- Count only response body bytes for HTTP metrics and reuse the output digest.

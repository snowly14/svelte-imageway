# Native ThumbHash display previews and leaner component derivation

## Context

Version 3.1.1 encodes ThumbHash in Rust but decodes its display pixels and writes its PNG data URL in JavaScript. The reference decoder repeatedly calculates cosine terms; the PNG writer grows JS arrays and calculates checksums per byte. The full Image/Picture entries remain over both the original 1536-byte stretch goal and the requested 2000-byte goal. Those are complete entry budgets with Svelte externalized, including every reachable Imageway helper; CSS is reported separately.

## Decision

Extend the existing server/build-only Rust module with ThumbHash inverse DCT, RGBA reconstruction and a bounded, reference-compatible uncompressed PNG writer. P/Q reconstruction shares each cosine basis multiplication while retaining the reference order of each independent sum. The encoder and decoder have separate bounded cosine tables because their reference multiplication order differs and interleaved calls must preserve cached coefficients. Reuse the existing 4096-byte pixel plane. PNG storage is 4400 bytes, with at most 4351 bytes emitted. The CRC lookup table has 256 entries; Adler-32 reduces once per row, where the admitted dimensions bound intermediate values below u32 overflow. No codec settings or compression semantics change.

Both host and native reject zero/oversized dimensions. Hashes are at most 25 bytes; the host rejects malformed headers and native checks every coefficient offset and exact encoded length before RGBA output. Scratch access remains synchronous per instance. Pixel results are owned copies, hashes are copied before native reads, and PNG base64 consumes the native view synchronously into an immutable JS string. No borrowed scratch view escapes. The entire module remains one fixed, non-growable 64 KiB memory with no imports or allocator. Consumers require no Rust compiler; WASM never enters browser entries.

ThumbHash previews use this full native display path, so `thumbhash` is removed from published runtime dependencies and retained as a pinned test/benchmark reference. Its MIT notice remains in the shipped `BLURHASH-NOTICE`. Missing/incompatible native artifacts fail with an actionable error; there is no silent fallback to another algorithm. `placeholder: 'none'` avoids loading the kernel. Sharp/libvips still handles source decoding, resizing and all ordinary image codecs. Ambiguous colour maxima retain the existing Sharp fallback.

Image/Picture read props directly and render the selected fallback snippet at one anchor, preserving loading/error aliases, native callbacks and callback context, source changes, cached completion, preload, reduced motion, SSR and no-JS output. Image preload attributes share one spread. Headless props avoid redundant alt/class extraction and skip provider lookup entirely for already optimized artifacts. This avoids parsing an irrelevant local URL (including the exception path) on ordinary registered imports. Provider behavior for raw URLs and custom providers is unchanged. No public API is removed, and no migration is required.

Rejected prototypes included a shared component-props wrapper: it grew both isolated bundles and was discarded. No browser WASM, hidden external helpers, omitted lazy chunks or reduced feature set is used to make the size target appear to pass.

## Verification and measurements

The independent native rebuild/fingerprint CI applies to every new export. Tests compare seeded alpha/opaque/non-square pixels, owned output, interleaved encoder/decoder calls and complete PNG bytes with ThumbHash 0.1.1. Raw native calls cover dimension and length rejection, fixed memory/growth rejection and maximum-size solid PNG checksums. A bounded JS control caches cosine/coefficient scratch; its PNG writer uses fixed typed storage, the same CRC table and row-level Adler reductions, plus native Node base64. This separates algorithm improvements from the additional Rust effect.

`bench/lean-preview/run.ts` compares the SHA-pinned npm 3.1.1 archive in seven alternating fresh-process sets over the pinned 24-photo corpus. It measures inverse DCT, inverse DCT plus PNG, complete previews with an unchanged LQIP control, and registered-URL attribute derivation. Complete output digests must match. Initialization, first batches, warm throughput, process RSS and desktop noise are reported separately. Incomplete runs carry `complete: false` and cannot support release claims.

Final numbers, including regressions and remaining size/build gaps, belong in `bench/LEAN-PREVIEW-3.1.2.md` and REPORT.md. Kernel speed alone establishes no codec, full-build, HTTP or cross-tool leadership.

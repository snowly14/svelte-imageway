# Bounded column conversion for BlurHash projection

## Decision

Keep Sharp/libvips for image decoding/resizing/encoding and the existing fixed-memory Rust/WASM preview kernel. In its 4x3 BlurHash projection, convert each RGBA column to linear RGB once, then reuse that column across the twelve coefficients. A 96-double local array requires at most 768 bytes of the existing 16 KiB stack. No decoded image cache, allocator, worker, import, memory growth, new export or browser WASM is introduced.

Every coefficient keeps the exact x-then-y accumulation order and norm-times-cosine multiplication order. A raw ABI differential gate compares all 36 doubles bit-for-bit across 64 seeded shapes, in addition to the existing independent hash, preview, color, ThumbHash, ownership, invalid-dimension and fixed-memory gates. Dimensions are checked before column/RGBA access. Existing explicit PREVIEW_ABI/installation errors remain the missing-artifact behavior; there is no silent codec or quality fallback.

JS packing uses cached 28-byte ASCII scratch, integer base83 division and an immutable string copy. Exact original square-root/gamma arithmetic remains. A boundary/extreme differential test covers quantization, and the optimized JS implementation serves as the control when attributing the native gain.

The rejected native packing and SIMD projection trials remain in the benchmark evidence. A language change alone is insufficient: final measurements must beat the optimized JS control including copies, FFI, validation and output allocation. See bench/COLUMN-PROJECTION-3.1.7.md for the measurements, startup/RSS costs and limits. No build-codec, HTTP or market-leadership claim follows from a preview-kernel result.

## Components

Image/Picture pass their options directly to the existing attribute builder; one destructure there filters component-only snippets/source metadata. Native onload/onerror and data attributes remain forwarded. Loading snippets are still separated from native loading strings. Image still rejects picture-only options, and SSR/preload/no-JS/lifecycle/reduced-motion behavior is retained. This removes one redundant options clone without adding an API or splitting hidden client chunks. The full feature set remains above the 2000-byte stretch goal.

## Contributors

No new native build step or dependency is required. Use Rust 1.99.0 with wasm32-unknown-unknown, then `bun run native:rebuild` and `bun run native:verify`. The latter independently recompiles and compares exact WASM bytes; CI already runs it separately from the six OS/Node jobs and browser job. Consumers receive precompiled WASM and need no Rust toolchain. The final column implementation uses scalar WASM and adds no SIMD requirement. Fixed initial/maximum memory stays 65536 bytes. The source/artifact fingerprint is committed in native/blurhash/manifest.json.

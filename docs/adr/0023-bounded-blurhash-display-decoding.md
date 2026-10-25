# Bounded native BlurHash display decoding

## Context and scope

Version 3.1.2 projects BlurHash coefficients in Rust but decodes the resulting hash to 16x16 RGBA through the `blurhash` JS package. Source inspection and a preliminary diagnostic identify repeated cosine evaluation, base83 parsing and gamma conversion. The reference is not an optimized-language control: a bounded JS implementation with cached lookup/cosine/coefficient scratch must also be measured.

This tranche handles only the internally generated 4x3/28-character hash and its existing 16x16 display preview. It does not rewrite Sharp/libvips codecs, introduce browser WASM, change preview dimensions/quality, remove component features or claim the open under-2000-byte component goal. The public API stays stable.

## Decision

Extend the existing fixed-memory precompiled Rust module with base83 parsing, bounded DC/AC coefficient reconstruction, inverse DCT and sRGB quantization. Reuse the existing pixel plane, coefficient storage and ThumbHash channel scratch; synchronous instance access prevents overlapping use. Add fixed cosine/threshold tables, a 2048-byte gamma hint table and at most 768 u16 fallback indices. The module retains one fixed, non-growable 64 KiB memory, no imports and no allocator. Consumers require no Rust toolchain.

The host rejects a hash of the wrong size/shape or non-ASCII input before copying into fixed storage. Native parsing independently validates all 28 bytes, 24-bit DC and AC values at most 6858 before pixel writes. Native output is exactly 256 opaque RGBA pixels; no user-controlled dimensions or allocations reach that path. The result owns its pixel copy. Each fallback index is checked before the host reads linear scratch and writes the pixel scratch before returning an owned copy.

Gamma uses a fixed hint table to find the neighbouring sRGB transition, followed by threshold refinement. A conservative 1e-7 band around transitions delegates those channels to the exact existing JS power expression. During lazy decoder initialization, the host validates both sides of all 255 transition bands against that expression. This avoids deciding rounding-boundary pixels from an approximation. Initialization is lazy so LQIP/ThumbHash do not construct the new gamma tables. The hint/threshold JS control uses the same algorithm; a second cached JS control keeps the reference power conversion to expose the algorithm/language contributions.

The production BlurHash preview uses the new owned RGBA result directly as Sharp input, avoiding an additional Buffer copy. Its WebP encoder/settings remain unchanged. The published `blurhash` runtime dependency is removed and its pinned development dependency remains for independent reference tests and benchmarks. Retain the Wolt MIT notice. Missing/incompatible WASM or unsupported rounding bounds fail explicitly; there is no silent decoder substitution. The only JS numeric fallback is the documented boundary conversion within the native algorithm.

## Safety and evidence

Differential tests cover 1024 seeded source encodings, 256 solids, 1024 arbitrary valid coefficient hashes, malformed ASCII/DC/AC/lengths, interleaved native operations and output ownership. Raw ABI tests force all 255 gamma boundaries from both sides and within the band, including all 768 fallback channels at once. Rejected hashes must leave pixels unchanged. Existing no-import/fixed-memory/growth tests and independent fingerprint/rebuild CI cover the new exports.

A SHA-pinned npm 3.1.2 baseline and the pinned 24-photo corpus drive seven alternating fresh-process sets. Report kernel initialization/first batch/warm throughput, complete BlurHash previews, unchanged LQIP/ThumbHash controls, cold/warm photographic builds, process RSS and a controlled photographic/synthetic comparison with imagetools/enhanced-img. Complete preview JSON and encoded image bytes must match; incomplete runs cannot support claims. Keep every regression, startup cost and remaining gap in `bench/BLURHASH-DISPLAY-3.1.3.md` and REPORT.md. No result is asserted before measurement.

Contributors use the existing Rust 1.99.0 target/rebuild/verify commands. No new toolchain/dependency is added. Future work should prioritize the default build/RSS and component-size gaps over rewriting small helpers merely to increase Rust's share.

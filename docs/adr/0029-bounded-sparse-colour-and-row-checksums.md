# Bounded sparse colour histogram and row-deferred PNG checksum

## Decision

Keep the existing fixed-memory Rust/WASM preview kernel and ABI. Dominant colour now records at most 1024 touched u16 bin indices on the existing fixed stack, updates the winner/tie state during counting, and clears touched bins before either unique or ambiguous return. Counts remain u16 <=1024, indices <=4095, and input dimensions are admitted before RGBA access. At most 2048 stack bytes are added within the existing 16 KiB reservation; linear memory remains capped at 65536 bytes. Calls are synchronous and every histogram starts/ends logically empty.

For byte v, floor(v*16/257) equals saturating_sub(v,1)>>4: bin thresholds are17,33,...,241. Test all256 byte boundaries against the independent division reference. Keep alpha ignored and return zero for tied maxima, preserving the Sharp/libvips fallback and exact output. Interleaved maximum-capacity/tied/invalid/unique calls must not leave stale bins.

PNG Adler-32 accumulates both a and b within a row and reduces them at the row boundary. With width<=32, a<=98160 and b<13million, safely within u32. Deferring a changes intermediate b only by multiples of65521; the final modulus is identical. CRC/layout/base64 remain unchanged. Raw PNG cases include full-white32x32 checksum carries and invalid dimensions leaving output untouched, compared byte-for-byte with the independent ThumbHash PNG reference.

## Why Rust and measured alternatives

Seven rotated fresh-process sets compare the published3.1.7 kernel with a sparse/LUT JS histogram and cached row-checksum JS PNG control, counting validation, FFI/input copies and immutable strings. Complete ThumbHash display and four Sharp preview strategies are also measured. Keep cold initialization, first batches, artifact growth and RSS visible. Native warm wins do not imply complete Sharp preview or default build improvements; every full-preview regression and worker/cross-tool result remains published in bench/SPARSE-COLOUR-3.1.8.md.

The precompiled artifact grows14702->14838bytes; no new export, import, allocator, SIMD requirement, consumer toolchain or browser WASM. Missing/incompatible native artifacts retain the existing explicit installation/ABI failure; no silent quality fallback is added. Only ambiguous histogram maxima retain their existing Sharp fallback. Contributors use the same Rust1.99.0 wasm32-unknown-unknown target and bun run native:rebuild/native:verify; existing fingerprint/full-rebuild CI verifies exact bytes.

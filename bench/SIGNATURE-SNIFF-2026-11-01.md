# Signature recognition — 1 November 2026

The Node pipeline now shares the PNG signature and checks TIFF/JXL bytes directly instead of allocating a PNG Buffer and formatting TIFF/JXL hex for every call. The public signature result, SVG validation and decoder policies are preserved. Existing processing caches invalidate conservatively because processing source changes.

`node bench/signature-sniff.ts` compares the frozen shipped 3.1.9 package with the current compiled package. It records seven alternating within-process pairs per synthetic signature, 30,000 calls per pair after 5,000 warm-up calls per implementation. Truncations, offset views and 4,096 seeded random inputs must agree. These tiny-buffer timings do not measure decoding, complete image builds, real image throughput or peak RSS. All samples, including JPEG's tiny difference, are retained in `results/signature-sniff-2026-11-01.json`. One shared process does not measure independent startup costs.

Initial sample medians (ns/call): PNG 126.70→79.83; TIFF little-endian 277.96→162.74; JXL codestream 352.45→162.66; SVG 1499.69→1293.60. These are descriptive local microbenchmarks, not overall build improvement claims. Complete-build measurements remain a separate task. Rust is inappropriate for this few-byte boundary: the existing Node operations already use native Buffer support and no extra FFI is introduced.

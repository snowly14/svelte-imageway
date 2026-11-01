# Signature recognition — 1 November 2026

The Node pipeline now shares the PNG signature and checks TIFF/JXL bytes directly instead of allocating a PNG Buffer and formatting TIFF/JXL hex for every call. The public signature result, SVG validation and decoder policies are preserved. Existing processing caches invalidate conservatively because processing source changes.

`node bench/signature-sniff.ts` compares the frozen shipped 3.1.9 package with the current compiled package. It records seven alternating within-process pairs per synthetic signature, 30,000 calls per pair after 5,000 warm-up calls per implementation. Truncations, offset views and 4,096 seeded random inputs must agree. These tiny-buffer timings do not measure decoding, complete image builds, real image throughput or peak RSS. All samples, including JPEG's tiny difference, are retained in `results/signature-sniff-2026-11-01.json`. One shared process does not measure independent startup costs.

Initial sample medians (ns/call): PNG 126.70→79.83; TIFF little-endian 277.96→162.74; JXL codestream 352.45→162.66; SVG 1499.69→1293.60. These are descriptive local microbenchmarks, not overall build improvement claims. Complete-build measurements remain a separate task. Rust is inappropriate for this few-byte boundary: the existing Node operations already use native Buffer support and no extra FFI is introduced.

## Complete-build follow-up

The seven-round cold/warm study in `results/signature-build-2026-11-01/` compares shipped 3.1.9 with the candidate (also including the Edge AVIF boundary correction). It uses the existing pinned photographic/synthetic corpus, identical integer widths and WebP quality 75, and isolated per-tool working directories. All output byte/SHA multisets match. The harness now accepts an explicit baseline package and records its version, location and compiled pipeline digest; defaults preserve older protocols. This study does not measure a previously warm project upgrading across the changed cache revision.

Photographic cold/warm medians are **352.89/61.85→347.32/60.34 ms**; cold process RSS **269.66→269.11 MiB**. Synthetic cold **97.55→97.95 ms** and cold RSS **264.70→267.50 MiB** regress, while warm **37.98→37.37 ms** improves slightly. The small photographic differences have overlapping ranges and do not establish a general build speedup. Imagetools and enhanced-img remain ahead: photographic cold **314.50/318.38 ms**, RSS **243.48/244.19 MiB**; synthetic cold **67.05/69.10 ms**. All raw results are retained.

Component source is unchanged: isolated Image/Picture **2957/3103 JS gzip bytes**, Svelte externalized, plus **206 CSS bytes** each. The under-2000-byte target remains unmet. Local checks pass **325 tests**, lint, strict TypeScript/Svelte, native independent rebuild and both JS/CSS budgets. Browser and registry delivery of these new changes have not been verified; this is not a publication receipt.

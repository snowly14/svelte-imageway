# 3.1.1: direct components and native ThumbHash — 23 October 2026

Public API, image settings and encoded preview bytes stay stable. The changes target component overhead and ThumbHash CPU work. Build/codec/HTTP leadership is not claimed; those paths are not rebenchmarked here. The previous [3.1 comparison](IMPROVEMENTS-3.1.md) remains dated evidence with open build/RSS gaps.

## Machine, source and protocol

Apple M4, 10 logical CPUs, 16 GiB, Darwin 27 arm64; Node 26.11.1, Bun 1.4.3, Vite 8.3.4, Svelte 5.57.2, Sharp 0.35.5, ThumbHash 0.1.1. Native measurements use product/harness commit **53b317820784cfbfa70453fd4a53ba3834e295e0**; final component measurements, including the accessibility fix, use **d1819d60b5520418f7c4537a9d887189112946ca**. Baseline: the verified npm **3.1.0** archive, SHA-256 `9c209ce1faef304334f7b71223f29801f5ebf50381244337a16ced2130828146`. Environment snapshots include native versions, timestamps, load and code fingerprints. Measurements run serially, without simultaneous local checks, on an uncontrolled desktop. Kernel and full-preview suites use the same 24 pinned Kodak photographs. Complete outputs must match by digest.

These are descriptive medians of seven alternating fresh-Node sets/pairs. Timing ranges overlap in full-preview tests; there is no statistical significance or universal speedup claim. Absolute preview latency in this busier session is much higher than the previous report for both versions. Do not compare their absolute times across sessions.

## Components: JS and CSS together

The private ImageElement layer is removed. Image/Picture render their markup and lifecycle directly, preserving loading/error snippets, callback context, source changes, cached completion, preload, reduced motion, SSR and no-JS output. Picture fallbacks stay outside the picture element. A reproduced pre-existing specificity bug is also fixed: active fade animations now stop under reduced motion. The regression checks actual animation names on both components. A small duplicated lifecycle/CSS block is an explicit maintenance tradeoff, covered for both components by a browser regression. [ADR 21](../docs/adr/0021-direct-components-and-native-thumbhash.md).

Isolated entry builds use the same compiler, Svelte externalized, gzip level 9. The table uses the published baseline package through the current harness; filename-derived compiler identifiers and minifier decisions are part of the artifacts. Use these paired figures instead of subtracting an independently located bundle in an older report. JS and CSS are compressed separately and summed, matching separate HTTP assets.

| Entry   | 3.1.0 JS | 3.1.1 JS | 3.1.0 CSS | 3.1.1 CSS | Total before → after |
| ------- | -------: | -------: | --------: | --------: | -------------------: |
| Image   |     3292 |     3109 |       213 |       220 |          3505 → 3329 |
| Picture |     3463 |     3247 |       213 |       218 |          3676 → 3465 |

Image/Picture JS shrink about 5.6%/6.2% in this paired entry build. The complete Image remains above **1536 gzip bytes**. Regression limits tighten to **3200/3350 JS bytes**, plus **3500/3650 JS+CSS bytes**. [Budget outputs](results/patch-3.1.1/component-budgets.json).

Real client entries include Svelte, an ordinary local import, responsive registration, styles and strict hydration over SSR. Each of seven repeated builds per variant produces the same sizes. A combined page exposes shared-runtime/CSS tradeoffs:

| Fixture | 3.1.0 JS | 3.1.1 JS | 3.1.0 CSS | 3.1.1 CSS | Total before → after |
| ------- | -------: | -------: | --------: | --------: | -------------------: |
| Image   |    18990 |    18855 |       204 |       208 |        19194 → 19063 |
| Picture |    20748 |    20596 |       204 |       208 |        20952 → 20804 |
| Both    |    20980 |    20937 |       204 |       250 |        21184 → 21187 |

**Both-component CSS grows 46 bytes and the total grows 3 bytes.** It is effectively unchanged, so the isolated-entry savings must not be marketed as the same percentage for complete pages. [Every client build](results/patch-3.1.1/clients.json). All six final fixtures preserve one identical selected image request, strict hydration without recovery, useful image loading with JavaScript disabled, and no console/JS/HTTP errors. [Browser receipt](results/patch-3.1.1/client-validation.json). No server/WASM code enters browser chunks.

## Rust ThumbHash: kernel and complete preview

Rust now calculates LPQA channels, bounded DCT and ThumbHash byte packing; display-preview PNG decoding remains in the server-side JS package. The precompiled module grows **2081→4570 bytes**, retaining exactly **64 KiB**, no host imports and rejected memory growth. One channel scratch plane is reused; at most 1024 RGBA pixels, 28 coefficients and a 25-byte owned hash are admitted. No Rust toolchain is required by consumers. Caller pixels and returned hashes cannot alias scratch memory. Missing/incompatible packaged WASM fails preview processing; `none` does not load it. Ambiguous dominant-colour maxima still fall back to Sharp statistics. Third-party notices ship with the artifact.

The controls are published ThumbHash 0.1.1, a cosine-cached bounded JS implementation with the same scratch/arithmetic as Rust, and the real Rust host method. The optimized JS control reads input directly; Rust includes its FFI input copy. Both validate dimensions and return owned hashes. Per process, sources are decoded outside the kernel timer, 25 complete 24-image batches warm up, then 500 batches time **12,000 hashes**. Checksums consume results; all hash-byte digests match. Q1–Q3 and ranges are retained.

| Kernel      | Median µs/hash | Q1–Q3 µs/hash | First 24-photo batch ms | Incremental initialization ms |
| ----------- | -------------: | ------------: | ----------------------: | ----------------------------: |
| referenceJS |         137.91 | 128.65–147.17 |                  19.273 |                         0.006 |
| cachedJS    |         100.32 |  92.60–114.34 |                  29.146 |                         0.320 |
| rust        |          56.85 |   49.07–65.24 |                   7.945 |                         5.194 |

The Rust path is about **2.43×** the reference throughput and **1.76×** the bounded JS control here. Reusing cosine tables/scratch accounts for part of the total gain; it is not all attributable to the language. Initialization excludes common statically imported dependencies for every mode; Rust's incremental initializer includes its dynamic loader, artifact read and compilation. It is not a comparison of total module-import costs. Peak process RSS includes source/decode setup and JIT, so it is not a production memory forecast. [All samples, initialization and RSS](results/patch-3.1.1/previews.json).

Complete previews include original-image decode, colour calculation, hash projection and display-preview creation, without persistent preview-cache reuse. Each process measures a first 24-photo batch, warms one batch, then times 72 previews. LQIP is an unchanged-path control. Full preview JSON digests must match the 3.1.0 package.

| Strategy  | 3.1.0 ms/photo (Q1–Q3) | 3.1.1 ms/photo (Q1–Q3) |
| --------- | ---------------------: | ---------------------: |
| thumbhash | 17.503 (16.326–19.674) | 16.143 (15.669–16.300) |
| lqip      | 19.596 (18.775–21.048) | 19.143 (19.106–21.652) |

Median full-process peak RSS is **131.36→130.56 MiB** for ThumbHash and **126.95→127.33 MiB** for LQIP. The small LQIP increase is retained; these isolated process peaks include setup and are not production memory forecasts.

The full ThumbHash median is about 7.8% lower, but the difference is larger than the isolated kernel savings and host variance is substantial. Do not attribute that entire difference to Rust. LQIP changes by only about 2.3% with overlapping ranges; **no LQIP, codec, HTTP or full-build speedup is established**. [Summaries](results/patch-3.1.1/preview-summary.json).

## Validation and reproduction

Local: lint, strict TypeScript/Svelte (zero errors/warnings), **257 unit tests**, native byte-identical rebuild, package/exports/types, tightened JS+CSS budgets and a fresh packed SvelteKit consumer pass. Chromium/WebKit: **12 pass, four optional-service skips**, including the new Image/Picture lifecycle regression. The source CI also passes all six OS/Node jobs, the independent native rebuild and Linux Chromium/Firefox/WebKit. Publication status and final-source CI links are recorded in [REPORT.md](../REPORT.md).

After `bun install --frozen-lockfile` and `bun run build`, extract the pinned 3.1.0 npm tarball to `.local/perf-3.2/baseline/package`, retaining the archive as `.local/perf-3.2/baseline.tgz`. The directory is the experiment workspace label; the actual candidate is 3.1.1. Photo preparation downloads missing Kodak files and verifies pinned digests. Archive existing results before rerunning:

```sh
bun bench/thumbhash/run.ts
bun bench/thumbhash/client.ts
bun bench/thumbhash/verify-client.ts
bun run check:budget
bun run check:picture-budget
bun run native:verify
```

Run suites serially. For isolated baselines, use `bun scripts/bundle-budget.ts --package-root=.local/perf-3.2/baseline/package`, with `--picture` for Picture. [Contributor native build steps](../CONTRIBUTING.md) and [algorithm/source notes](../docs/adr/0021-direct-components-and-native-thumbhash.md) describe the new native surface. The result manifest records source, report and raw-file hashes; it is not a signature.

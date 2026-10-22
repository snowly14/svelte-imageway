# 3.1.0: measured build and preview improvements — 23 October 2026

These are incremental wins, not market leadership. Imageway remains slower and uses more cold-build RSS than the two comparators on both controlled corpora. Full Image still exceeds the original 1536-byte stretch budget. No public API migration is needed.

## Protocol and source

Apple M4, 10 logical CPUs, 16 GiB RAM, macOS/Darwin 27 arm64; Node 26.11.1, Bun 1.4.3, Vite 8.3.4, Svelte 5.57.2, Sharp 0.35.5, vite-imagetools 12.0.1, enhanced-img 1.0.0. Full native codec versions, timestamp and desktop load are recorded in each raw file. This is one uncontrolled desktop; suites run serially, OS cache is not flushed, and there is no statistical or universal superiority claim. Earlier photographic measurements were made in a different, busier session; do not infer a speedup from their absolute times.

Baseline: published npm 3.0.1 archive, SHA-256 `9c681cc39e4bdb2116ad24de59d49b650f4c58283294edacd73c4958db0c15e2`. Product changes: `cd3c2ee` (Rust colour/lazy SVGO), `85f9af7` (preview cache/component simplifications). Paired build/preview/client/kernel data identifies `85f9af7`; cross-tool data identifies `f8bd26f` (only harness/docs changed). Native output and codec settings are identical. [Source/data fingerprints](results/improvements-3.1/manifest.json) accompany complete raw samples.

Seven alternating before/after pairs for responsive builds, previews, client and histogram; three pairs for the larger default-import workload. Each build is a fresh Node process. Cold deletes persistent tool caches; warm immediately repeats with cache. The cross-tool suite rotates four engines over seven rounds on each corpus. Timers include each tool import and Vite build, with common Vite/Svelte imports outside all tool timers; process wall times additionally include startup and output validation. RSS is peak process RSS including worker threads, not heap size.

Controlled photography: the same 24 pinned Kodak PNGs as [3.0.1](PHOTOGRAPHIC.md), widths 288/384/480, WebP quality 75, fit inside, no preview. All 72 image byte/SHA multisets match: **1,324,124 bytes**. Synthetic: three deterministic 1200×800 fixtures, the same widths/format/quality, nine byte-identical outputs, **40,502 bytes**. Integer output heights avoid fractional aspect-rounding differences. Imageway uses `q=75`; both comparators use `quality=75`.

A rejected synthetic mixed JPEG/WebP pilot exposed different JPEG settings (MozJPEG in Imageway) and alpha-channel fallback to PNG; it is excluded from timing rankings. The controlled synthetic comparison uses WebP throughout. Codec size/SSIM curves remain the dated 3.0.1 experiment; no new visual-quality advantage is claimed. Since output bytes are unchanged, this release preserves that measured quality.

## Cross-tool controlled builds

Medians in milliseconds; parentheses are Q1–Q3, n=7. RSS is the median cold peak in MiB. Raw ranges, warm RSS and process wall times: [all samples](results/improvements-3.1/comparison.json), [summaries](results/improvements-3.1/comparison-summary.json).

| Corpus       | Engine         |     Cold ms (Q1–Q3) |     Warm ms (Q1–Q3) | Cold RSS MiB |
| ------------ | -------------- | ------------------: | ------------------: | -----------: |
| photographic | Imageway 3.0.1 | 437.8 (435.6–440.5) | 123.7 (118.2–124.6) |        408.7 |
| photographic | Imageway 3.1.0 | 378.6 (373.3–381.2) |    60.5 (59.2–65.2) |        397.5 |
| photographic | imagetools     | 328.8 (325.6–331.1) |    51.3 (50.9–52.7) |        241.4 |
| photographic | enhanced-img   | 326.9 (324.7–333.6) |    57.2 (55.8–58.5) |        244.3 |
| synthetic    | Imageway 3.0.1 | 167.9 (163.4–177.8) |   96.9 (96.1–102.5) |        321.0 |
| synthetic    | Imageway 3.1.0 | 104.8 (103.1–111.2) |    37.3 (37.1–38.8) |        309.8 |
| synthetic    | imagetools     |    68.0 (67.5–68.6) |    32.5 (32.0–34.4) |        247.0 |
| synthetic    | enhanced-img   |    70.2 (69.6–71.2) |    34.6 (33.6–35.4) |        252.1 |

Photo cold/warm gaps versus imagetools remain approximately 15%/18%; versus enhanced-img approximately 16%/6%. The synthetic cold gap is approximately 54%/49%. Cold photo RSS remains about 156 MiB above imagetools. The worker/process overhead and larger automatic codec workload remain priorities; runtime security isolation has not been weakened to improve these tables.

## Paired complete workloads

Same 24 photographs. The separate LQIP workload adds previews to the controlled WebP build. Default imports use the ordinary-import format/width policy, retain originals, generate AVIF before byte-safe pruning and emit 156 image files totaling 19,317,212 bytes in both versions. This is more work than the comparator table. [Raw samples](results/improvements-3.1/build.json), [dispersion](results/improvements-3.1/build-summary.json).

| Workload   | Cache | 3.0.1 ms | 3.1.0 ms | 3.0.1 RSS MiB | 3.1.0 RSS MiB |
| ---------- | ----- | -------: | -------: | ------------: | ------------: |
| responsive | cold  |    450.5 |    383.8 |         408.8 |         396.1 |
| responsive | warm  |    121.4 |     63.2 |         236.7 |         224.2 |
| lqip-build | cold  |    549.5 |    425.5 |         413.4 |         401.5 |
| lqip-build | warm  |    297.9 |     61.8 |         252.1 |         224.2 |
| automatic  | cold  |   5918.6 |   5834.8 |         566.3 |         542.1 |
| automatic  | warm  |    323.2 |     89.0 |         300.1 |         280.8 |

Default cold build barely changes (~1.4% descriptive difference, only three pairs). Do not attribute encoder acceleration to this release. Warm LQIP improves approximately 4.8× by avoiding preview decode, while cold LQIP falls approximately 23%. [Untimed CPU profiles](results/improvements-3.1/profiles.json) sample 13 SVGO/css-tree modules before and none after on the raster build. Profiles are diagnostic and not included in timing tables; main-thread sampling cannot measure native codec execution on other threads. Larger default cold cost, with AVIF work still required before pruning, remains an encoding bottleneck.

## Previews and Rust control

Full previews include decoding, dominant colour and display-preview encoding, without the persistent preview cache. Each process reads inputs outside the timer, measures a first 24-photo batch, performs a warmup batch and measures 72 further previews. All complete preview JSON digests match 3.0.1. [Full samples/init/first-batch/dispersion](results/improvements-3.1/preview.json), [summaries](results/improvements-3.1/preview-summary.json).

| Strategy  | 3.0.1 ms/photo | 3.1.0 ms/photo |
| --------- | -------------: | -------------: |
| color     |          9.281 |          5.312 |
| lqip      |          9.617 |          5.799 |
| blurhash  |          9.463 |          5.452 |
| thumbhash |          9.313 |          5.416 |

The separate histogram control compares optimized JS with the actual Rust host/kernel path, not two package versions. It uses identical quantization, tie handling and hex output on the same decoded ≤32×32 RGBA inputs, with validation/copy costs included. Per process: 25 warmup batches, 500 timed batches = 12,000 calls. Medians: **4.151 µs JS / 3.053 µs Rust** (about 1.36×), initialization **0.036 / 1.000 ms**. First 24-photo batches: 1.056 / 0.262 ms. These kernel savings alone do not explain the much larger full-preview gain: avoiding Sharp's unused statistics does most of that work. [All native-control samples](results/improvements-3.1/histogram.json).

The new native surface is a bounded histogram for all preview strategies. Decode/resize/encode remain Sharp/libvips; ThumbHash projection remains JS. WASM is 2081 bytes, fixed/non-growable 64 KiB, precompiled, no browser delivery. Ambiguous maxima use Sharp for byte identity; missing/incompatible packaged WASM fails preview processing (reinstall/rebuild), while `none` never loads it. [ADR, limits and fallback](../docs/adr/0020-native-preview-colour-and-lazy-build-tools.md), [contributor rebuild/verify steps](../CONTRIBUTING.md).

## Components and validation

Svelte externalized, gzip level 9, same compiler and budget harness against both package roots:

| Entry   | 3.0.1 bytes | 3.1.0 bytes | Regression budget |
| ------- | ----------: | ----------: | ----------------: |
| Image   |        3305 |        3277 |              3400 |
| Picture |        3470 |        3446 |              3600 |

The old full-Image 1536-byte stretch target is still unmet. These savings are tiny. Real SSR/hydrated fixture JS, including Svelte, is **19,010→18,993 bytes for Image** and **20,742→20,749 bytes for Picture**: Picture grows seven bytes in that particular page despite a smaller isolated entry. No meaningful whole-page transfer gain is claimed. Current and baseline already discard server policy constants in these fixtures; the pure annotation has not established a useful client reduction. [Client raw data](results/improvements-3.1/client.json), [isolated sizes](results/improvements-3.1/component-budgets.json).

All four strict SSR/hydration fixtures (Image/Picture × before/after) load one identical selected WebP, with no recovery, console warnings, JS errors or failed responses. No WASM/server code enters the client bundle. [Browser receipt](results/improvements-3.1/client-validation.json). Local lint, TypeScript, Svelte (zero errors/warnings), 255 unit tests, native byte-identical rebuild, package/exports/types, both budgets, Chromium/WebKit (10 pass, four optional service skips) and a fresh packed strict SvelteKit consumer pass. Consumer cached install/build/typecheck: 4.8 seconds; this is not a cold-network claim. Linux Firefox and the full OS/Node matrix are release CI gates; see REPORT.md for final publication status.

HTTP TTFB, runtime cache throughput and paid provider deployments are not remeasured. Their implementation/admission limits are unchanged; no runtime or paid-cloud speedup is claimed. URL contract tests remain part of the unit suite.

## Reproduction

Use Bun, the pinned lockfile and a Node runtime matching the report. Fetch/extract the SHA-pinned 3.0.1 npm archive to `.local/release-3.0.1/svelte-imageway-3.0.1.tgz` and `.local/perf-3.1/baseline/package`. The harness rejects an unexpected archive hash. `bun run fixtures` prepares the example source; the fixtures-only command below generates deterministic synthetic inputs without running historical benchmark comparisons. Photo preparation verifies the pinned corpus manifest and downloads missing originals.

```sh
bun install --frozen-lockfile
bun run fixtures
bun run bench:build --fixtures-only
bun run build
bun run bench:improvements .local/perf-3.1/baseline/package build
bun run bench:improvements .local/perf-3.1/baseline/package preview
bun run bench:improvements .local/perf-3.1/baseline/package histogram
bun run bench:improvements .local/perf-3.1/baseline/package client
bun bench/improvements/compare.ts
bun bench/improvements/verify-client.ts
bun bench/improvements/profile.ts
bun run check:budget
bun run check:picture-budget
bun run native:verify
```

Run each suite serially. Re-running writes the 3.1 result directory; archive existing evidence first. To measure an older isolated component with the current compiler, pass `--package-root=.local/perf-3.1/baseline/package` to `scripts/bundle-budget.ts` (and `--picture` for Picture).

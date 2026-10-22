# Reproducible package benchmarks

## Current 3.1.0 comparison — 23 October 2026

[Build, preview, Rust and component results](IMPROVEMENTS-3.1.md): paired npm 3.0.1 baseline, byte-identical photographic and synthetic WebP comparisons with both competitors, full-preview/histogram controls, SSR/client validation and all raw samples. Warm LQIP builds improve 298→62 ms locally; default cold encoding and the 1.5 KiB component stretch remain open. Cross-tool build/RSS leadership is not achieved.

## Historical photographic comparison — 22 October 2026

Read the [3.0.1 photographic benchmark](PHOTOGRAPHIC.md): 24 Kodak photographs, byte-identical WebP outputs across Imageway/vite-imagetools/enhanced-img, separate default-import costs, codec size/SSIM curves, repeated mobile browser loads and a Rust versus optimized-JavaScript preview comparison. Raw samples, exact versions, hashes and limitations are included.

**Historical correction:** the synthetic cross-tool scripts below used `q=75` for imagetools/enhanced-img, which ignore that parameter and used Sharp quality 80 here. Resize policies and JPEG encoders also differed. Those size/timing tables are historical evidence, not an equal-quality ranking. The photographic comparison uses each tool’s real quality directive and rejects different output bytes. The historical HTTP/cache and Lighthouse measurements remain dated and are not refreshed by the photographic suite.

## 3.0.0 Rust preview kernel — 22 October 2026

Seven alternating fresh-process sets on Apple M4, Node 26.11.1. The reference is blurhash 2.0.5. The optimized JavaScript control uses the same cached sRGB/cosine lookups and arithmetic order as Rust. Times include encoding, host/WASM copies, validation and hash packing, after 25 warm-ups. This measures the optional 4x3 BlurHash preview encoder, not JPEG/WebP compression or delivery.

| RGBA input | Reference JS | Optimized JS | Rust/WASM host path |
| ---------- | -----------: | -----------: | ------------------: |
| 32×32      |     435.2 µs |      26.1 µs |              9.1 µs |
| 32×21      |     282.7 µs |      17.6 µs |              6.5 µs |
| 12×8       |      39.8 µs |       3.4 µs |              1.9 µs |

The lookup rewrite accounts for most of the difference from the original JS encoder; Rust adds about 2.8× versus the optimized JS control for 32×32. Rust strategy initialization has a roughly 0.9–1.0 ms median per fresh child and fixed 64 KiB instance memory. First-operation timings are retained separately. Do not multiply these kernel ratios into full image processing rates.

Complete Sharp+BlurHash previews compared against the published 2.0.0 baseline: synthetic square 5.393 → 5.004 ms median; landscape PNG 12.471 → 12.250 ms. These descriptive local differences are about 7.2% and 1.8%; host noise is uncontrolled, particularly relevant to the smaller gain. Complete output digests match, including the preview image and hash. Default LQIP, JPEG/WebP codecs, HTTP rates and total builds were not accelerated by this kernel. [Every sample and initialization timing](results/preview-rust.json).

Image entry: 3290 gzip bytes; Picture: 3453, Svelte externalized. Both component regression gates pass (3400/3600). The original full-Image 1536-byte stretch goal remains unmet. Rust WASM is 1719 bytes, loaded only on build/server paths, and absent from browser entries. StaticImage/StaticPicture were removed. [Current sizes](results/component-size.json), [historical 2.0 sizes](results/component-size-2.0.0.json).

```sh
# Extract the verified published 2.0.0 npm archive outside source directories, then:
bun run bench:preview <2.0.0-package>/dist/vite/placeholder.js
```

## 2.0.0 API and bundle validation — 22 October 2026

Image 3290 gzip bytes, StaticImage 1391, Svelte peer externalized. [Current measured entries](results/component-size.json), [1.5.0 entries](results/component-size-1.5.0.json). Automatic URL metadata resolution adds bytes, while img/picture contracts are now explicit. Both regression gates pass (3400 and 1536 respectively); the original 1536-byte full-Image stretch goal remains unmet. No encoder or HTTP speedup is claimed for 2.0. Older performance tables below keep their measured versions.

## 1.5.0 parsed representation cache — 21 October 2026

Seven alternating baseline/current pairs against published 1.4.0 source `62e4343` (implementation `571136a`), Apple M4, Node 26.11.1. Each processor child starts fresh with an empty disk cache, prepares the synthetic source and excludes the native first transform plus 20 warm-ups. It then measures sequential prepared-source memory-cache hits. Default memory limits apply. Outputs are byte-identical across variants. These are API cache lookups, not encoder, browser or CDN throughput.

| Prepared memory-cache lookup | Output bytes | 1.4.0 ops/s | 1.5.0 ops/s | Ratio |
| ---------------------------- | -----------: | ----------: | ----------: | ----: |
| Small synthetic WebP         |        1,580 |      14,733 |      26,681 | 1.81× |
| Synthetic texture WebP       |      155,112 |       5,048 |      10,478 | 2.08× |
| Synthetic landscape PNG      |      246,641 |       3,209 |       6,609 | 2.06× |

The cache retains private parsed metadata and an owned payload, returns one defensive copy and fingerprints its frozen policy once. Encoder settings and encoded bytes are unchanged. [All processor samples](results/processor-comparison.json).

A separate complete local HTTP comparison uses seven alternating fresh-process pairs, one cold request, 30 warm repeats and 100 burst requests at concurrency four. Both versions have their built-in cache; every response digest is checked.

| HTTP median      |          1.4.0 |          1.5.0 |
| ---------------- | -------------: | -------------: |
| Cold TTFB        |      69.056 ms |      69.295 ms |
| Warm TTFB        |       0.269 ms |       0.256 ms |
| Burst throughput | 8389.203 req/s | 9344.921 req/s |
| Peak RSS         |    147.594 MiB |    148.344 MiB |

The final HTTP series has 11.4% higher median burst throughput and essentially unchanged cold TTFB. This is a descriptive local measurement, not a statistical or market-wide guarantee. [Final HTTP samples](results/runtime-comparison.json). A first series had much noisier cold/warm TTFB and a 46.4% throughput difference; it is retained in [initial trial](results/runtime-comparison-1.5.0-trial.json). A subsequent same-code A/A control gave cold medians 69.1/68.4 ms and burst 8633.7/8924.3 req/s, then prompted the final repeated series. [A/A control](results/runtime-control.json). No previous result was discarded or interpreted as a controlled cross-session speedup. Desktop load and thermal state are uncontrolled. Do not infer a native encoding speedup from cache lookup gains.

Reproduce serially after generating fixtures with bench:build and preparing the 1.4.0 baseline dist:

```sh
IMAGEWAY_BENCH_BASELINE_REF=62e4343 bun run bench:processor:compare <1.4.0-dist>/node/processor.js
IMAGEWAY_BENCH_BASELINE_REF=62e4343 bun run bench:runtime:compare <1.4.0-dist>/kit/handler.js
```

JXL is not encoded by these benchmarks. [JPEG XL capability and fallback guide](../docs/guides/jpeg-xl.md), [measured native codec inventory](results/codecs.json). No custom libjxl-enabled build was tested. Component budgets remain StaticImage 1196 / full Image 3158 gzip bytes with Svelte externalized. Older build/cross-tool/Lighthouse measurements below retain their original versions and dates.

## 1.4.0 paired measurements — 21 October 2026

Compared with 1.3.1 source `44b8b59`, using seven alternating baseline/current pairs per suite. Current build and HTTP outputs are verified byte-identical to the baseline. Both HTTP variants use their built-in cache. This is a busy Apple M4 desktop, Node 26.11.1; host background load/thermal state are uncontrolled. Suites ran serially without concurrent package verification. Absolute numbers differ substantially from the earlier session below; they are not a cross-session speedup claim.

| Build median    |     1.3.1 |    1.4.0 |
| --------------- | --------: | -------: |
| Cold            | 1172.5 ms | 825.7 ms |
| Disk cache warm |  185.0 ms | 195.6 ms |

| HTTP median      |        1.3.1 |         1.4.0 |
| ---------------- | -----------: | ------------: |
| Cold TTFB        |    285.81 ms |     342.68 ms |
| Warm TTFB        |      2.75 ms |       1.34 ms |
| Burst throughput | 375.86 req/s | 1368.56 req/s |
| Peak RSS         |   200.36 MiB |    147.64 MiB |

Cold build median is 29.6% lower and warm HTTP burst throughput is 3.64× baseline in this session. Cold build RSS rises from 295.5 to 356.5 MiB with up to four workers; `imageway({ concurrency: 2 })` retains a smaller pool. Warm build median is 5.8% higher; first HTTP request median is 19.9% higher. No cold-HTTP improvement, warm-build gain, statistical significance or market-wide leadership is claimed. HTTP peak RSS decreases with fewer source copies; process RSS is not a hard native-memory cap.

Cold build min–max: baseline 874.2–1291.6 ms, current 728.4–1026.0 ms. Warm build min–max: baseline 179.3–233.8 ms, current 134.7–206.2 ms. Full samples: [build comparison](results/comparison.json), [Historical 1.4.0 HTTP comparison](results/runtime-comparison-1.4.0.json). The prepared-source snapshot is copied/hashed once and cannot be mutated by its caller. Source TTL, authorization, output copying and worker limits remain enforced. Encoder settings have not changed.

```sh
IMAGEWAY_BENCH_BASELINE_REF=44b8b59 bun run bench:compare <1.3.1-dist>/vite/index.js
IMAGEWAY_BENCH_BASELINE_REF=44b8b59 bun run bench:runtime:compare <1.3.1-dist>/kit/handler.js
```

The cross-tool, IPX and Lighthouse measurements below remain explicitly **1.3.1** results; they were not rerun for 1.4.0. Component size was rerun and remains StaticImage 1196 / full Image 3158 gzip bytes.

## Current session — 21 October 2026, version 1.3.1

Apple M4, 10 logical CPUs, 16 GiB RAM, macOS arm64. Build children use Node 26.11.1 and Sharp 0.35.5; Bun 1.4.3 orchestrates the scripts. `environment.node` in build.json is Bun's compatibility version, not the child runtime; each row records the actual Node version. Source: `9336bd8b1ff31f7ba52dc231e3c300cce1df45f5` (published 1.3.1 implementation). All benchmark suites ran successively, without concurrent package builds or tests. Host-wide CPU contention and thermal state are not controlled.

## Build comparison

Three cold/warm pairs per tool, fresh Node process per build. Cold deletes the relevant disk cache. Three opaque synthetic 1200×800 sources × widths 320/640/960 × WebP/JPEG quality 75 = 18 output images. Placeholder work is disabled where configurable. Imageway uses mozjpeg; the other tools use their JPEG defaults. Equal numeric quality is not equal perceptual quality.

| Median          |  Imageway | vite-imagetools | enhanced-img |
| --------------- | --------: | --------------: | -----------: |
| Cold build      | 1071.3 ms |        156.2 ms |     138.4 ms |
| Warm disk build |  174.6 ms |         39.6 ms |      39.7 ms |
| Output bytes    |   498,652 |         745,147 |      745,147 |

Strong within-session variability: cold min–max imageway 277.9–1186.2 ms; imagetools 154.3–484.6 ms; enhanced-img 135.5–589.2 ms. Fixed engine order can also introduce order effects. These descriptive medians do not establish a stable performance ratio. Build parity is not met. [All samples and codec versions](results/build.json), [raw rows](results/build.raw.json).

## Paired version comparison

Seven alternating before/after pairs against source `0c408b0`; fresh processes, cold reset then warm repeat. All 18 image outputs are verified byte-identical across every run.

| Build median    | 1.2 baseline |    1.3.1 |
| --------------- | -----------: | -------: |
| Cold            |     279.2 ms | 290.4 ms |
| Disk cache warm |      47.3 ms |  53.0 ms |

No build speed improvement or statistical significance is established. This is a separate session from the cross-tool measurements; absolute timings must not be combined into a speedup claim. [Historical 1.3.1 paired samples](results/comparison-1.3.1.json).

## Runtime HTTP

Three fresh Node processes per engine; local HTTP, same source, width 640, WebP q75. One cold request, 30 repeats, then 100 requests at concurrency four. Imageway includes memory/disk caching; bare IPX has no added CDN cache. Warm results measure that configured service topology, not pure encoding throughput or production CDN performance.

| Median across processes |      Imageway |          IPX |
| ----------------------- | ------------: | -----------: |
| Cold TTFB               |      72.23 ms |     46.65 ms |
| Warm median TTFB        |       0.77 ms |     23.34 ms |
| Burst throughput        | 1602.58 req/s | 139.06 req/s |
| Peak RSS                |    203.27 MiB |   186.70 MiB |

Both emit 14,482 bytes. Imageway repeats report 100% cache hits. [All HTTP samples and metrics](results/runtime.json). Worker timing was skipped because no endpoint was configured; [worker-local.json](results/worker-local.json) remains a dated local emulator measurement, not a new or managed Cloudflare measurement.

## Component size and image weight

StaticImage: **1,196 gzip bytes**; complete Image: **3,158 gzip bytes**, with Svelte externalized. The smaller component omits provider/snippet/transition features. Only StaticImage meets the original 1,536-byte target. [Current size measurements](results/component-size.json).

Six source-to-960px WebP/AVIF q75 outputs give 92.0% median byte reduction, including resizing. Texture AVIF reduces only 52.1%; this is not a perceptual quality study or a promise for arbitrary photos. [Weight samples](results/build.json). The separately dated [format-selection case](results/format-selection.json) measures omitted dominated AVIF variants; both encodings are still computed, so this does not reduce encoding work.

## Browser performance

The freshly built component verification fixture scored **100/100** in one Lighthouse 13.5.0 mobile run (390×844): CLS **0**, LCP **1.681 s**, TBT **22 ms**; LCP discovery passes. This is one local fixture run, not a universal site score. [Raw metrics](results/lighthouse.json). Reproduce after `bun run build:components` by serving the component example on port 4173 and running `bun scripts/lighthouse.ts`. The task-owned preview was stopped after measurement.

## Reproduce

```sh
bun install --frozen-lockfile
bun run build
bun run bench:build
IMAGEWAY_BENCH_BASELINE_REF=<source-commit> bun run bench:compare <baseline-dist>/vite/index.js
bun run bench:runtime
bun run check:picture-budget
bun run check:budget
```

Run suites serially. Prepare the baseline dist from the stated source first; paired builds reuse the fixtures generated by bench:build. Version pins are in bun.lock. Worker measurement requires an explicit IMAGEWAY_BENCH_WORKER_URL.

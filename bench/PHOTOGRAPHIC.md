# Photographic benchmark — 22 October 2026

Imageway **3.0.1**, including the asset-reference fix found while running this corpus. Product source: [5075f6a](https://github.com/snowly14/svelte-imageway/commit/5075f6a7243fbb989d656b7b898f1768edca1299). Per-suite harness revisions, tool/codec versions and all individual samples are recorded in the raw JSON.

The controlled build emits **72 byte-identical WebP files totaling 1,324,124 bytes** with each tool. Imageway is slower in every measured round against vite-imagetools. Default automatic imports do substantially more work. The Rust kernel is 1.56× faster than the optimized JavaScript control by ratio of medians, while the complete BlurHash preview medians are **35.28 ms JS / 36.75 ms Rust**. No consistent end-to-end speedup is established. These are local observations, not a market-wide ranking.

## Corpus and controls

All **24 [Kodak photographs](https://r0k.us/graphics/kodak/index.html)**, fetched unchanged and pinned by URL, dimensions, byte count and SHA-256 in [corpus.json](results/photographic-3.0.1/corpus.json). Original dimensions are 768×512 or 512×768. Downloads remain in the ignored local directory; the images are not redistributed in this repository. The source page contains the photography credits and distribution information.

Host: Apple M4, 10 logical CPUs, 16 GiB RAM, darwin/arm64, OS 27.0.0, Node v26.11.1, Bun 1.4.3. Vite 8.3.4, Sharp 0.35.5, libvips 8.18.7, vite-imagetools 12.0.1, enhanced-img 1.0.0, Svelte 5.57.2.

Suites run serially. Cold means the tool's persistent cache was deleted; the OS file/page cache was **not** flushed. Seven interleaved fresh Node processes per tool/cache state; a second identical Imageway case provides an A/A control. Native/thread concurrency uses tool defaults. Peak RSS is the Node process high-water mark, including worker threads. All samples, including unusually fast first-round samples, are retained. This desktop was not isolated, frequency-locked or thermally controlled; ranges and the A/A results matter. No confidence interval or universal significance claim is made from seven rounds.

## Build: equal encoded work

24 photographs × widths **288/384/480** × WebP quality 75, fit inside, no placeholder or originals. Widths preserve integer aspect ratios for both orientations, avoiding resampling-policy differences. Every one of the 56 controlled builds must emit the same 72 SHA-256/byte-count pairs before its timing is accepted. Imageway uses `q=75`; imagetools/enhanced-img use their actual `quality=75` directive.

The timer includes candidate module loading, Vite and emitted outputs; file validation happens afterward. JSON also reports full child-process wall time, including startup and validation, and every min/max. This stage consumes the tools' import metadata, without rendering a page; component delivery is measured separately below.

| Tool / A/A control | Cold ms: median [Q1–Q3] | Warm ms: median [Q1–Q3] | Cold peak RSS MiB |
| ------------------ | ----------------------- | ----------------------- | ----------------- |
| imageway           | 1581.4 [1468.2–1730.7]  | 533.8 [517.7–558.0]     | 407.5             |
| imagetools         | 979.6 [958.4–1054.4]    | 181.9 [163.1–201.2]     | 234.8             |
| enhanced-img       | 1085.8 [1019.7–1098.8]  | 223.1 [189.6–224.9]     | 236.5             |
| imageway-control   | 1614.8 [1532.3–1704.3]  | 569.3 [526.7–605.3]     | 406.1             |

Paired ratios use runs from the same round. Above 1 means Imageway took longer.

| Comparator       | Imageway/comparator cold ratio: median [min–max] | Warm ratio: median [min–max] |
| ---------------- | ------------------------------------------------ | ---------------------------- |
| imagetools       | 1.61× [1.33–1.91]                                | 2.74× [2.03–3.87]            |
| enhanced-img     | 1.50× [1.31–1.71]                                | 2.44× [1.99–3.15]            |
| imageway-control | 1.00× [0.86–1.27]                                | 0.94× [0.84–1.16]            |

## Build: ordinary automatic imports, defaults

This is a **separate workload**, three cold/warm process pairs: all default formats, responsive ladder, LQIP previews, retained originals and automatic registry metadata. All six default-build output digest multisets also match each other. Cold **24038.9 [15607.2–24039.9] ms**, warm **1213.9 [1080.9–1222.2] ms**; cold range 7175.6–24040.9 ms, peak RSS median **525.7 MiB**.

The build emits **156 image files**, 19,317,212 bytes, including 15,394,305 bytes of original PNGs. These disk totals are not browser download totals. Default AVIF candidates are encoded before larger ones are pruned; this corpus retains no AVIF outputs. This extra work must not be compared as if it were the same 72-file job above. It is a clear area to investigate for future improvements.

## Codec size, time and measured similarity

All 24 photos resized to width 512 without enlargement. Four Sharp encoder configurations, five quality values (50/65/75/85/95), three passes: **1,440 encodes**, with repeated output digests checked. Timings include decode, resize and encode, excluding file reads and SSIM. Codec order reverses on the second pass. Each timing sample covers the full 24-photo set.

[SSIM.js 3.5.0](https://github.com/obartra/ssim) fast algorithm, original RGB-to-luminance conversion, no metric downsampling, 11-pixel Gaussian window. The reference is the identically resized uncompressed image. This metric measures luminance structure; it does not establish equal human-perceived quality or color fidelity. Native codec defaults are unchanged apart from quality and the explicitly identified mozjpeg flag.

**Equal numeric quality is not equal visual quality.** These q75 points show why a size comparison alone is insufficient:

| Encoder at numeric q75 | Total KiB / 24 | Mean SSIM | Minimum SSIM | Decode/resize/encode ms / 24: median [Q1–Q3] |
| ---------------------- | -------------- | --------- | ------------ | -------------------------------------------- |
| jpeg-default           | 928.5          | 0.9417    | 0.9185       | 402.3 [356.6–425.4]                          |
| jpeg-mozjpeg           | 740.8          | 0.9267    | 0.8943       | 1049.5 [1033.7–1080.7]                       |
| webp                   | 694.4          | 0.9469    | 0.9148       | 1131.8 [1118.7–1244.4]                       |
| avif                   | 1049.8         | 0.9765    | 0.9633       | 11176.3 [7895.1–11190.0]                     |

The complete five-point curves and per-photo scores are in the raw data. The following diagnostic chooses the smallest candidate meeting the threshold **per photo**, from that discrete five-quality grid. Every photo must pass before a total is compared; missing cases are shown. It is a coarse grid, not an exact rate-distortion optimum, and not a perceptual-quality ranking.

| Target minimum SSIM per photo | Encoder      | Photos meeting target | Total KiB, only if all 24 pass |
| ----------------------------- | ------------ | --------------------- | ------------------------------ |
| 0.95                          | jpeg-default | 24/24                 | 1234.8                         |
| 0.95                          | jpeg-mozjpeg | 24/24                 | 1481.0                         |
| 0.95                          | webp         | 24/24                 | 916.9                          |
| 0.95                          | avif         | 24/24                 | 737.5                          |
| 0.98                          | jpeg-default | 22/24                 | —                              |
| 0.98                          | jpeg-mozjpeg | 15/24                 | —                              |
| 0.98                          | webp         | 24/24                 | 1865.9                         |
| 0.98                          | avif         | 24/24                 | 1488.7                         |

## Browser: actual SSR and hydration

Chromium 156.0.8078.4; **210 navigations** = 7 interleaved rounds × 3 photographs × 5 cases × cold/cached. Viewport 390×844, DPR 2; applied CDP throttling: 100 ms latency, 1.6 Mbps download, 750 Kbps upload, 4× CPU slowdown. HTML/JS/CSS use gzip and HTTP caching. New context per case/pair; second navigation reuses the browser HTTP cache. All 105 cached navigations transfer zero image bytes; all 210 navigations have measured CLS 0. These are observed local LCP values, not Lighthouse simulations or production Core Web Vitals.

All cases render the same single visible photo with explicit dimensions, eager loading, synchronous decoding, high priority and preload. Imageway uses normal imports and explicit plugin settings: 256/384/512/768, WebP+JPEG, q75, no placeholder. Native responsive markup is extracted from Image SSR, stripped of Svelte event-replay attributes, and compiled as an ordinary Svelte image; it has no Imageway loading/error state. Enhanced-img uses the same widths and WebP quality 75. Native-original serves the source PNG with the same dimensions and priority. This is a well-authored native baseline, rather than an intentionally unconfigured image.

Each navigation must request **one image**, load successfully with no page JS errors and produce LCP. The four optimized cases must select the **same encoded WebP by SHA-256** for each photo; none downloads the original as a second image. Cached transfer and layout-shift samples are retained. Built JS gzip totals use gzip level 6, before the local server adds each case’s URL prefix. They include Svelte and all built page scripts, so they differ from isolated component budgets. Actual resource transfer sizes, including the URL-prefix rewrite, are recorded separately in the raw samples.

### kodim01.png

| SSR + hydrated case | Cold LCP ms: median [Q1–Q3] | Cached LCP ms: median [Q1–Q3] | Requested image KiB | Total JS gzip KiB |
| ------------------- | --------------------------- | ----------------------------- | ------------------- | ----------------- |
| imageway-image      | 1380.0 [1130.0–1406.0]      | 44.0 [36.0–48.0]              | 75.6                | 19.1              |
| imageway-picture    | 1272.0 [922.0–1392.0]       | 48.0 [36.0–68.0]              | 75.6                | 20.8              |
| native-responsive   | 1024.0 [692.0–1070.0]       | 40.0 [26.0–48.0]              | 75.6                | 10.4              |
| native-original     | 4344.0 [3984.0–4432.0]      | 24.0 [20.0–44.0]              | 719.2               | 10.0              |
| enhanced-img        | 1048.0 [866.0–1074.0]       | 40.0 [34.0–42.0]              | 75.6                | 14.4              |

### kodim13.png

| SSR + hydrated case | Cold LCP ms: median [Q1–Q3] | Cached LCP ms: median [Q1–Q3] | Requested image KiB | Total JS gzip KiB |
| ------------------- | --------------------------- | ----------------------------- | ------------------- | ----------------- |
| imageway-image      | 1232.0 [1068.0–1478.0]      | 48.0 [38.0–50.0]              | 104.5               | 19.1              |
| imageway-picture    | 1260.0 [984.0–1362.0]       | 44.0 [28.0–60.0]              | 104.5               | 20.8              |
| native-responsive   | 964.0 [840.0–1228.0]        | 40.0 [26.0–52.0]              | 104.5               | 10.4              |
| native-original     | 4796.0 [4600.0–4848.0]      | 36.0 [28.0–52.0]              | 803.4               | 10.0              |
| enhanced-img        | 1216.0 [890.0–1288.0]       | 52.0 [38.0–54.0]              | 104.5               | 14.4              |

### kodim23.png

| SSR + hydrated case | Cold LCP ms: median [Q1–Q3] | Cached LCP ms: median [Q1–Q3] | Requested image KiB | Total JS gzip KiB |
| ------------------- | --------------------------- | ----------------------------- | ------------------- | ----------------- |
| imageway-image      | 928.0 [806.0–1046.0]        | 44.0 [36.0–44.0]              | 23.0                | 19.1              |
| imageway-picture    | 824.0 [782.0–860.0]         | 52.0 [46.0–58.0]              | 23.0                | 20.8              |
| native-responsive   | 808.0 [762.0–850.0]         | 36.0 [34.0–36.0]              | 23.0                | 10.4              |
| native-original     | 3452.0 [3266.0–3464.0]      | 44.0 [28.0–52.0]              | 544.5               | 10.0              |
| enhanced-img        | 848.0 [688.0–874.0]         | 36.0 [28.0–44.0]              | 23.0                | 14.4              |

These are isolated image pages, not a full application. Sub-millisecond or small LCP differences on cached pages do not establish a reliable winner. Network transfer and identical selected bytes explain why optimized approaches can land close together. The lossless PNG comparison includes both resizing/codec choice and quality differences; its time saving cannot be attributed solely to the component.

## Rust: useful scope and full pipeline

The shipped [Rust source](../native/blurhash/lib.rs) produces the optional 4×3 BlurHash projection in a precompiled **1,719-byte WASM module with fixed 64 KiB memory**. No Rust compiler is required by consumers, and this module is absent from browser bundles. JPEG/WebP/AVIF compression and resizing already use native Sharp/libvips.

Seven alternating fresh-process rounds, the same 24 photos per batch. Both controls cache lookup tables; this comparison does not attribute lookup caching to Rust. Kernel timer includes validation/copies and final hash string packing, but excludes preparing the 32-pixel RGBA inputs. Each process warms 25 batches and times 500 batches (12,000 hashes). Full previews include decode32, dominant-color stats, hash, decode16 and WebP encoding; one warmup batch and three timed batches (72 previews). The Rust pipeline's output is additionally checked against the actual package placeholder function. Digests must match JS/Rust at both levels.

| Operation                                | Optimized JS µs/photo: median [Q1–Q3] | Rust/WASM µs/photo: median [Q1–Q3] | Ratio of medians JS/Rust |
| ---------------------------------------- | ------------------------------------- | ---------------------------------- | ------------------------ |
| Complete 4×3 hash, host copies + packing | 59.3 [56.9–69.9]                      | 38.0 [34.4–39.3]                   | 1.56×                    |
| Full BlurHash preview                    | 35275.1 [31733.9–38150.2]             | 36748.8 [33634.2–37616.1]          | 0.96×                    |

| Operation | Paired Rust/JS time ratio: median [min–max] |
| --------- | ------------------------------------------- |
| kernel    | 0.60× [0.48–0.85]                           |
| pipeline  | 0.98× [0.37–1.28]                           |

Rust initialization median: **3.675 ms**; first 24-photo batches are recorded separately after input preparation. One retained Rust pipeline sample falls to 13.42 ms/photo versus its 36.75 ms median, illustrating the uncontrolled host variation. The full pipeline table is the relevant limit on preview gains; kernel speedups do not automatically apply to whole builds, the default LQIP strategy or image compression.

[Goose was evaluated](../docs/adr/0019-focused-components-and-rust-previews.md). Its own language benchmarks do not measure this image workload; no Goose integration or speedup is claimed here.

## Reproduce and inspect

```sh
bun install --frozen-lockfile
bun run build
bun run bench:photos
# Or run one stage, serially:
bun run bench:photos build
bun run bench:photos quality
bun run bench:photos browser
bun run bench:photos native
```

Node and Playwright Chromium must be available; install the matching browser with `bun run playwright install chromium`. The corpus is fetched on first use, then SHA-256 verified against the committed manifest. Scripts fail instead of accepting unequal outputs or a broken page. Do not run other benchmarks/tests at the same time. Local outputs/cache are under `.local/photographic`. Raw files:

- [manifest.json](results/photographic-3.0.1/manifest.json) — SHA-256 of raw data and measurement source files
- [corpus.json](results/photographic-3.0.1/corpus.json)
- [environment.json](results/photographic-3.0.1/environment.json)
- [build.json](results/photographic-3.0.1/build.json)
- [build-summary.json](results/photographic-3.0.1/build-summary.json)
- [quality.json](results/photographic-3.0.1/quality.json)
- [quality-summary.json](results/photographic-3.0.1/quality-summary.json)
- [browser.json](results/photographic-3.0.1/browser.json)
- [browser-summary.json](results/photographic-3.0.1/browser-summary.json)
- [native.json](results/photographic-3.0.1/native.json)
- [native-summary.json](results/photographic-3.0.1/native-summary.json)

The earlier synthetic cross-tool tables used `q=75` for all tools. That directive is ignored by imagetools/enhanced-img, giving their Sharp default quality 80 in this installed version; mozjpeg and resampling policies also differed. Their historical size/timing results are retained, but **must not be used for an equal-quality ranking**. This corrected photographic series supersedes that cross-tool comparison. Historical HTTP/cache and single-run Lighthouse measurements are not refreshed by this report.

## Limits

One non-isolated Apple M4 desktop; three codec timing passes and seven process/browser rounds. Kodak is a small-resolution opaque SDR photographic corpus. This does not cover 4K photography, alpha, animation, HDR, concurrency under production traffic, uploads, remote fetching, network failures, CDN/cache geography, SSRF admission overhead or serverless cold starts. Next.js was not benchmarked. No claim of best-in-market performance is supported.

# Component size and unused preview clones — 27 October 2026

Baseline: the verified npm 3.1.8 archive, SHA-256 `7d4b09a7140a79204c4b4a77bf8fabecc81c8aecc7d16c09b016ce549efd9480`. Apple M4, 10 logical CPUs, 16 GiB; Node 26.11.1, Bun 1.4.3, pinned workspace dependencies. Suites were serialized on one active desktop; OS caches were not flushed. Every raw row, input hash, quartile, process RSS and environment is in [results/perf-3.1.9](results/perf-3.1.9). See `artifacts.json` for the frozen candidate/source fingerprints. Timings are local measurements, not universal rankings.

Before editing, seven cold/warm rounds at logical concurrency 1/2/4 used the 3.1.8 baseline. Photographic cold medians were **969.0/546.2/342.9 ms**, process peak RSS **255.1/262.5/270.9 MiB**; warm medians were **58.6/58.9/58.6 ms**. The baseline uses one physical worker. The copied harness initially mislabeled its topology; the raw record retains that original label and explicitly corrects it without altering samples. Four remains the default concurrency.

## Components and rendering

Svelte is externalized for isolated entries; every emitted JS and CSS file is counted separately at gzip level 9. The same workspace/compiler gives:

| Entry   | Before JS | After JS | CSS each | Total before→after |
| ------- | --------: | -------: | -------: | -----------------: |
| Image   |      2983 |     2957 |      206 |          3189→3163 |
| Picture |      3131 |     3103 |      206 |          3337→3309 |

Both components keep the same public props, SSR/no-JS, native callbacks, alt requirement, priority preload, snippets, providers and reduced-motion support. **The under-2000-byte goal is unmet.** The baseline archive's path and emitted filename can affect compression; do not mix these same-workspace figures with extracted-archive measurements.

Seven alternating fresh-process actual client pairs include Svelte, ordinary image imports, every emitted JS/CSS file and byte-identical image assets. Final complete-page totals: Image **18546→18534**, Picture **20322→20305**, Both **20651→20637 gzip bytes**. Six final strict hydration/no-JS fixtures load the expected image and make one selected image request; browser errors are rejected. A headless-only root import emits no CSS and changes **1764→1751 JS gzip bytes**.

Seven SSR pairs render complete Apps containing 24 Images, 24 Pictures or 24 pairs after 100 warm-up renders; **complete HTML digests must match with no normalization**. Medians per App: Image **77.57→77.65 µs** (a small regression), Picture **84.75→83.40**, Both **153.77→152.03**. These are server fixture times, not browser-rendering measurements. Full ranges remain in the raw data.

Seven paired headless attribute samples preserve complete canonical attributes. Relative **0.1696→0.1710 µs** and art **0.3374→0.3438 µs** regress slightly; shorthand **0.6224→0.5718 µs**, mapped **8.9224→8.8187 µs**. A separate relative-provider control is **7.9103→7.9165 µs**. These are API-call timings with overlapping ranges, not complete-page speed claims.

The attempted component-level metadata filtering increased isolated JS **2983→3007 / 3131→3163** and was rejected. A private specialized props split changed Image **2961→2961** while growing Picture **3110→3144** and was also rejected. Their sources/patches and diagnostic measurements remain in `rejected-component-filter.*` and `rejected-split/`. Neither is part of the package.

## Transform and full builds

Seven alternating fresh-Node pairs per mode process the 24 pinned Kodak photos at three integer widths (288/384/480 px), WebP quality 75. One 72-image warm-up batch precedes one timed batch; file reads and Vite/worker startup are outside the timing. The complete encoded data and all metadata, including previews, must match for each mode. This is sequential Sharp work, not build concurrency or HTTP.

| Mode            | Before µs/image | After µs/image | Before peak RSS MiB | After peak RSS MiB |
| --------------- | --------------: | -------------: | ------------------: | -----------------: |
| no preview      |        12139.93 |       12069.54 |              156.61 |             139.39 |
| preview enabled |        25796.71 |       25817.74 |              205.06 |             205.19 |

Without previews, peak process RSS is **11.0% lower** in this experiment and the median time decreases **0.6%**. Preview-enabled time/RSS are slightly higher; keep those controls and do not claim a universal transform speedup. The native codec/quality are unchanged, and no output-weight reduction is claimed.

Seven rotated/reversed cold/warm cross-tool rounds clear each tool cache and use each Vite root as child cwd. All request WebP quality 75, fit inside and the same integer widths with no preview. Every sorted image byte/SHA multiset matches. Photographic cold baseline/candidate/imagetools/enhanced-img: **344.33/341.24/309.71/310.91 ms**, peak RSS **273.73/270.50/246.56/244.03 MiB**; warm **57.93/57.79/48.49/51.05 ms**. Candidate cold timing ranges overlap; build and RSS leadership remain open. Synthetic cold **94.39/92.22/65.14/66.45 ms**; warm **36.04/35.53/30.11/32.16 ms**. All rows and dispersion remain in `comparison.json` and its summary.

Seven separately paired ordinary-import builds include all 24 photos, default AVIF/WebP/JPEG settings, byte-safe pruning, LQIP and four logical transforms. All **156 files / 19,317,212 bytes** match. Baseline→candidate cold **5589.28→5658.24 ms (+1.2%)**, peak RSS **430.55→418.27 MiB**; warm **85.74→85.26 ms**, RSS **282.55→283.19 MiB**. The cold timing regression is retained; this separate default-policy fixture is not a cross-tool quality comparison.

## Reproduce

Use Bun and serialize heavy suites. Verify/extract the pinned npm archive to `.local/component-3.1.9/baseline/package`; build and freeze a candidate package as documented in `artifacts.json`. Run `bun bench/perf-3.1.9/build-workers.ts baseline` before architecture edits, then `comparison --candidate=<frozen-package>` for cross-tool builds. Run `pipeline.ts`, `automatic.ts --pairs=7 --study=<new-label>`, `attributes.ts` (and `--local-provider` into a fresh output directory), `headless-bundle.ts`, `ssr.ts`, `client.ts --output-dir=<fresh-directory>`, and `verify-client.ts` serially. Preserve every old JSON before re-running; drivers that accept an output path/label must use a fresh location. The default automatic/pipeline scripts currently use the candidate path recorded in the sources; create it explicitly.

The Rust preview module is unchanged at 14838 bytes and fixed 64 KiB. Its source fingerprint and independent rebuild remain required; no new browser WASM, consumer compiler, Rust/FFI speed claim, paid-cloud, image-quality, HTTP or market-leadership claim is made. The prior [3.1.8 study](SPARSE-COLOUR-3.1.8.md) documents the Rust kernel and build executor.

# Bounded column projection — 26 October 2026

## Scope and protocol

A SHA-pinned published 3.1.6 archive (SHA256 `665d5afdd4fc5caca74387541b143f8996c65eacf8cc4c1222c0f8903ede1a27`) is the baseline. The 24-photo Kodak corpus is checked against the existing manifest. Final raw data, quartiles, environment and artifact fingerprints: [results](results/column-projection-3.1.7/measurements.json), [summary](results/column-projection-3.1.7/summary.json), [artifacts](results/column-projection-3.1.7/artifacts.json). The source patch preserves the measured candidate; final cleanup removes unused reference JS packing code and renames its private factory, without changing the timed algorithm.

Apple M4, 10 logical CPUs, 16 GiB, macOS Darwin 27, Node 26.11.1, Bun 1.4.3, Sharp 0.35.5. This is an active desktop, not a controlled laboratory; no OS cache flush. Heavy suites run serially. Seven rotated/reversed fresh-Node sets per variant; medians and every original row retained. Encode decodes photos to <=32x32 RGBA before timing, records initialization and first 24-image batch, warms 25 batches, times 12000 encodes and consumes output. Hash digest must match in every process. Timing includes host copies, validation, FFI and immutable string results. Complete previews include Sharp resize/color/hash/display generation: first batch, one warm batch, then 72 sequential previews with full JSON byte identity. Unchanged LQIP is a noise/regression control. RSS is process peak, not a native heap measurement.

The optimized JS control keeps baseline scalar Rust projection but caches ASCII/base83 scratch. The column-only ablation combines the new Rust kernel with original JS packing. This distinguishes Rust algorithm gains from avoidable JS string work.

## Complete encode path

| Variant                             | Median µs/hash | Initialization ms | First 24 batch ms | Peak RSS MiB |
| ----------------------------------- | -------------: | ----------------: | ----------------: | -----------: |
| Published 3.1.6                     |         39.488 |             4.806 |             4.167 |      127.125 |
| Optimized JS packing / old kernel   |         35.758 |             4.936 |             3.063 |      122.375 |
| Rust column kernel / old packing    |         24.994 |             4.253 |             2.747 |      127.344 |
| Selected column kernel + JS packing |         23.719 |             4.271 |             3.546 |      122.516 |

Selected warm encode time falls **39.9%** against published baseline and **33.7%** against the optimized JS control. Column-only time falls **36.7%** against baseline; its process peak RSS increases 0.219 MiB. Selected RSS is 0.141 MiB above optimized JS, so no native-memory reduction is claimed. First-batch latency regresses against optimized JS despite lower initialization/warm medians. Each coefficient remains bit-identical, with no quality change.

## Complete preview and retained regressions

| Complete preview | Before µs | Selected µs |        Change | Before/after RSS MiB |
| ---------------- | --------: | ----------: | ------------: | -------------------: |
| BlurHash + Sharp | 19476.939 |   19733.829 | +1.32% slower |    130.875 / 130.859 |
| Unchanged LQIP   | 19186.891 |   20661.297 | +7.69% slower |    130.125 / 129.953 |

BlurHash first batch is 465.545→477.518 ms; LQIP first batch is 545.336→406.890 ms. Variable Sharp/desktop times dominate and unchanged LQIP also regresses. These results support a bounded CPU-kernel improvement, **not** a complete-preview, codec, cold/warm-build, HTTP or market-leadership claim. Default builds/workers/codecs and runtime admission are unchanged; the prior photographic/synthetic imagetools/enhanced-img studies remain the latest cross-tool evidence, including their regressions. Under-2000-byte and build/RSS leadership goals remain open.

## Rejected native work

The [original 63-row period](results/native-pack-3.1.7/measurements.json) is retained separately. Baseline encode was 45.979 µs, optimized JS 36.990, Rust scalar quantization/base83 40.918 and SIMD projection plus native packing 44.257. Neither native alternative beat the optimized JS control. They are rejected; their complete-preview changes cannot override that failed selection gate. [Summary](results/native-pack-3.1.7/summary.json), artifact fingerprints and source/host patches under native-pack preserve the experiments. A subsequent square-root packing probe also failed to demonstrate a gain and was rejected; its source patch is retained, without promoting the short diagnostic to a performance claim. Final code has no new SIMD requirement or packing export.

## Component size

Complete isolated entries, Svelte externalized, gzip9: Image **2963→2953 JS bytes**, CSS **220→220**, total **3183→3173**. Picture **3117→3096 JS**, CSS **218→218**, total **3335→3314**. Every reachable Imageway helper is included. This is a modest reduction from removing duplicate options filtering; **under 2000 remains unmet**.

Seven alternating fresh-process real SSR/hydration builds count Svelte, all JS/CSS assets and identical image byte/SHA multisets. Image page **18561→18553 total gzip bytes**, Picture **20324→20316**, Both **20712→20695**. These page savings are smaller than isolated-entry savings and CSS fingerprint/compiler differences remain included. See clients.json and client-validation.json for completeness and actual strict-hydration/no-JS checks. Do not interpret byte totals as browser rendering speed.

## Reproduce selected study

Use the repository's pinned Bun installation and lockfile. Ordinary consumers need no native compiler. Native contributors use Rust 1.99.0 and wasm32-unknown-unknown; `bun run native:verify` independently rebuilds byte-identical output. The final artifact grows **13978→14702 bytes**, while initial/maximum memory remains **65536 bytes**, with no imports, allocator or growth. The local RGB column is at most 768 stack bytes. See ADR 27 for safety and missing-artifact behavior.

```sh
bun install --frozen-lockfile
bun run build
mkdir -p .local/native-pack-3.1.7/baseline
curl -fL https://registry.npmjs.org/svelte-imageway/-/svelte-imageway-3.1.6.tgz -o .local/native-pack-3.1.7/baseline.tgz
# Verify SHA256 above before extracting. Runner also checks the original release archive.
mkdir -p .local/release-3.1.6
cp .local/native-pack-3.1.7/baseline.tgz .local/release-3.1.6/svelte-imageway-3.1.6.tgz
tar -xzf .local/native-pack-3.1.7/baseline.tgz -C .local/native-pack-3.1.7/baseline
# Prepare the pinned photographic corpus using bench/photographic instructions.
bun bench/native-pack/prepare.ts
bun bench/native-pack/run.ts --final --output-dir=.local/column-reproduction
bun bench/native-pack/client.ts --output-dir=.local/column-reproduction
bun bench/native-pack/verify-client.ts --output-dir=.local/column-reproduction
```

The runner refuses to overwrite existing measurements. Historical rejected trials are immutable; their native patches apply to source commit 69ab957c78301328534710afdf80e22587886b11, and rejected-host.patch applies to baseline dist/node/blurhash.js. Rebuild each patched source with scripts/native.ts compiler/linker flags and overlay its host into an isolated baseline package. The optimized control and complete protocol remain in native-pack; never run historical trials against the selected current kernel while keeping old labels.

## Headless attribute cost

Seven alternating fresh-process pairs with 1000 warm batches, then 240000 calls (24000 for mapped providers), consuming output and requiring identical canonical attribute digests. This longer warm study follows a retained short 24000-call selection period, which is too sensitive to startup/JIT for steady-state claims. All data, quartiles and regressions are in attributes*.json.

| Scenario   | Before µs | After µs | Change |
| ---------- | --------: | -------: | -----: |
| relative   |     1.172 |    1.388 | +18.4% |
| absolute   |     1.300 |    1.285 |  -1.2% |
| empty-map  |     7.744 |    7.314 |  -5.6% |
| registered |     0.901 |    1.039 | +15.3% |
| mapped     |    45.179 |   47.497 |  +5.1% |

The relative and registered cases regress by about 0.2/0.14 µs; filtering component metadata has a small shared headless cost. Retain these costs alongside the small client-byte savings, rather than claiming a universal component speedup. Provider and empty-map timing changes on this busy desktop do not establish browser or network performance.

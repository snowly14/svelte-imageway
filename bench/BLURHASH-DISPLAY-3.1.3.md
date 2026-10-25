# 3.1.3: bounded native BlurHash display decoding — 25 October 2026

This tranche moves generated 4x3 BlurHash display decoding into the existing precompiled Rust module. It preserves the public API, preview dimensions, image settings, pixels and complete preview bytes. The published `blurhash` runtime dependency is removed; the pinned development reference remains. [ADR 23](../docs/adr/0023-bounded-blurhash-display-decoding.md).

The isolated decoder wins against two optimized JS controls. **A large end-to-end gain is not established.** The initial full-preview median regresses; a prespecified confirmation produces a small improvement. Both studies remain published. Cold build RSS increases, and controlled build/RSS leadership against imagetools/enhanced-img remains unmet. Image/Picture sources and their unmet 2000-byte goal are unchanged.

## Source, machine and protocol

Baseline: verified npm **3.1.2**, archive SHA-256 `f136df477dc8cc625caf0d9a39e39242a92c0cb7ee307a48956f89d7ed664644`. Primary kernel, preview and build sources/harness match commit **1b9b7510487c1d531c048d39349235e91c153b27**. The confirmation matches **833622f309f1e2e5cb2c894903b855d89e877323**; only its additional harness changes, with identical product sources. Environment records retain empty tracked-source diff fingerprints. Incomplete runs cannot support claims: final primary previews/build/comparison/confirmation/store checks carry `complete: true` and **70/56/112/60/35 rows** respectively.

Apple M4, 10 logical CPUs, 16 GiB, Darwin 27 arm64; Node 26.11.1, Bun 1.4.3, Vite 8.3.4, Svelte 5.57.2, Sharp 0.35.5/libvips 8.18.7, Rust 1.99.0, BlurHash reference 2.0.5. The 24 Kodak SHA-256s are revalidated before suites. The three deterministic synthetic 1200×800 inputs have their byte/digest manifests retained. Suites run serially, without concurrent heavy local checks, on an uncontrolled desktop. Starting load averages are approximately **1.69/1.93/3.67**, **2.25/2.02/3.62**, **2.82/2.18/3.63** for preview/build/comparison. OS caches are not flushed. Medians and interpolated Q1–Q3 are descriptive, not statistical-significance or universal-production claims.

## Decoder: reference, optimized controls and Rust

The reference repeatedly calculates cosine terms and uses reference power gamma conversion. `cachedJS` caches base83/sRGB/cosine/coefficient scratch while retaining that exact gamma expression. `thresholdJS` adds the same 2048-byte gamma hint, 255 transition thresholds and conservative 1e-7 boundary fallback as Rust. This exposes algorithm improvements separately from the language effect. All variants return owned 16x16 RGBA and must match by digest.

Hashes and source decoding are prepared outside timing. Each fresh process measures initialization and its first 24-hash batch, warms 25 batches, then times 500 batches (**12000 calls**), consuming results via checksum. Rust includes validation, the ASCII input copy, native execution, exact boundary conversion and the owned output copy. Native gamma tables initialize lazily inside the first batch; the JS controls initialize their tables during factory creation. Incremental initialization excludes common imports and is not whole-process startup.

| Decoder                       | Median µs/hash |    Q1–Q3 µs | First 24-hash batch ms | Incremental initialization ms | Median process peak RSS MiB |
| ----------------------------- | -------------: | ----------: | ---------------------: | ----------------------------: | --------------------------: |
| Reference JS                  |          32.12 | 32.04–32.23 |                  2.365 |                         0.002 |                      134.16 |
| Cached JS, power gamma        |           9.17 |   9.16–9.25 |                  1.348 |                         0.101 |                      131.34 |
| Cached JS, threshold gamma    |           6.86 |   6.83–6.88 |                  1.254 |                         0.375 |                      142.67 |
| Rust, exact boundary fallback |           2.98 |   2.97–3.00 |                  0.559 |                         0.872 |                      142.66 |

Rust delivers about **2.30×** the best optimized JS throughput, **3.08×** cached power JS and **10.8×** the reference here. Most reference-to-control savings are algorithm/scratch reuse; they are not all attributable to Rust. Native initialization is larger and cannot be hidden behind warm throughput. Process RSS includes source/hash preparation, imports and JIT; it is not the kernel allocation or a production memory forecast. [Every sample](results/blurhash-display-3.1.3/previews.json), [summaries/ranges](results/blurhash-display-3.1.3/summary.json).

### Additional check with identical output stores

The original JS controls return `Uint8ClampedArray`, following the reference; the native method returns owned `Uint8Array`. A supplementary seven-set rotated/interleaved study adds plain `Uint8Array` JS controls with otherwise identical cached-power and threshold algorithms. Product code remains identical to the published release source. This checks whether the store representation explains the kernel win, without replacing the original study. Sources/harness match commit **240cbda45ff1b08dd75c67ac6e844f57cc262d5d**.

| Supplementary decoder         | Median µs/hash |  Q1–Q3 µs |
| ----------------------------- | -------------: | --------: |
| Cached power JS, clamped      |           9.10 | 9.09–9.12 |
| Cached threshold JS, clamped  |           6.84 | 6.79–6.92 |
| Cached power JS, plain U8     |           9.06 | 9.03–9.09 |
| Cached threshold JS, plain U8 |           6.74 | 6.72–6.79 |
| Rust, plain U8                |           2.94 | 2.92–2.96 |

The same-store comparison still gives about **2.29×** native throughput. Plain stores reduce the threshold JS median slightly; they do not explain most of the gain. All owned byte digests match. This is a later measurement period, not a pooled replacement for the first table. [All samples and context](results/blurhash-display-3.1.3/stores.json), [summaries/initialization/RSS](results/blurhash-display-3.1.3/stores-summary.json). Initialization remains larger for Rust; process RSS is **142.72/142.89 MiB** for the plain threshold JS/native paths and is not a production memory forecast.

## Exactness, memory and CPU diagnostics

The precompiled artifact grows **11111→13978 bytes**. Its linear memory remains one fixed, non-growable **64 KiB** page with no imports or allocator; no WASM enters a browser bundle and consumers need no compiler. The decoder admits only its internally generated **28-character/4x3** representation and emits exactly **16x16 opaque RGBA**. Native validates ASCII/base83, DC/AC bounds and length before pixel writes. Fixed scratch reuses existing coefficients/pixels/channel storage. Owned output prevents interleaved hash/colour operations or caller mutations from corrupting earlier results.

A hint table locates the neighbouring gamma transition. Values within **1e-7** of a transition use the existing exact JS power expression. The host validates both sides of every transition band before enabling the lazy decoder. Raw ABI tests force all 255 boundaries from both sides and within the band, including **768 fallback channels at once**. Rejected hashes leave pixels unchanged. Differential tests cover **1024 seeded source hashes, 256 solids and 1024 arbitrary valid coefficient hashes**, interleaved native operations and output ownership. Complete reference WebP bytes remain a unit gate.

An untimed diagnostic sees **one fallback channel among 18,432** for the corpus. Main-thread CPU profiles show the reference decoder and gamma helper among the largest sampled frames; native math appears in WASM frames. Profiles include setup/hash preparation and exclude Sharp's other native threads. Profiler overhead is excluded from all timed tables; full local profiles are retained by SHA. [Diagnostics and fingerprints](results/blurhash-display-3.1.3/diagnostics.json). Independent CI recompiles the whole artifact byte-identically, now treating Rust warnings as errors. The Wolt MIT notice remains shipped.

## Complete previews: initial regression and confirmation

Each process reads source images before timing, measures the first 24-photo batch, warms one batch, then times 72 sequential previews. This includes source decoding, colour extraction, hash encoding/decoding and Sharp's WebP encoding. No persistent preview cache is reused. Complete output JSON digests must match. Unchanged LQIP and ThumbHash are controls.

| Primary 7 sets | 3.1.2 ms/photo (Q1–Q3) | 3.1.3 ms/photo (Q1–Q3) | Median process peak RSS MiB before → after |
| -------------- | ---------------------: | ---------------------: | -----------------------------------------: |
| BlurHash       |    5.242 (5.215–5.344) |    5.327 (5.191–5.490) |                            133.95 → 133.92 |
| LQIP           |    5.429 (5.408–5.456) |    5.406 (5.387–5.479) |                            133.88 → 133.95 |
| ThumbHash      |    5.012 (4.998–5.059) |    5.008 (4.989–5.090) |                            130.23 → 130.20 |

The initial complete BlurHash median is **1.6% slower**, despite the faster kernel. Its first 24-photo batch is **132.850→129.624 ms**. Ranges overlap. This unexpected steady-state result justified a focused confirmation rather than silently discarding the first study.

The confirmation was prespecified as **15 additional fresh-process sets**, interleaving BlurHash-before/after and unchanged LQIP-before/after, reversing order on alternate sets. It uses the same child protocol and byte gate. It is reported separately, without replacing or pooling away the original regression:

| Confirmation 15 sets | 3.1.2 ms/photo (Q1–Q3) | 3.1.3 ms/photo (Q1–Q3) | Median process peak RSS MiB before → after |
| -------------------- | ---------------------: | ---------------------: | -----------------------------------------: |
| BlurHash             |    5.210 (5.204–5.227) |    5.175 (5.168–5.205) |                            133.78 → 133.81 |
| LQIP                 |    5.405 (5.385–5.438) |    5.407 (5.393–5.428) |                            134.34 → 133.70 |

The confirmation is about **0.7% faster** for BlurHash and effectively unchanged for LQIP. This small difference is compatible with the isolated math saving; it does not establish a large preview/codec/delivery improvement. Retain both periods and their variance. [All confirmation samples](results/blurhash-display-3.1.3/confirmation.json), [summaries](results/blurhash-display-3.1.3/confirmation-summary.json).

## Cold/warm photographic builds

Seven alternating before/after pairs per strategy use 24 photographs, explicit widths 288/384/480, WebP quality 75, `fit=inside` and 72 identical emitted images. Tool caches are removed before every cold build; the immediate fresh-process warm repeat keeps caches. OS caches remain warm. `buildMs` starts before plugin import and ends before output verification; process startup/verification is separately retained. Full preview identity is independently gated above.

| Strategy/cache |       3.1.2 ms (Q1–Q3) |       3.1.3 ms (Q1–Q3) | Median whole-process peak RSS MiB before → after |
| -------------- | ---------------------: | ---------------------: | -----------------------------------------------: |
| BlurHash cold  | 408.92 (405.47–419.13) | 407.00 (402.79–409.28) |                                  397.61 → 400.94 |
| BlurHash warm  |    61.51 (60.36–62.47) |    60.72 (59.78–61.40) |                                  222.27 → 222.53 |
| LQIP cold      | 402.84 (400.95–409.15) | 403.18 (401.15–406.30) |                                  396.25 → 399.20 |
| LQIP warm      |    60.99 (59.90–62.61) |    61.99 (60.74–62.61) |                                  223.05 → 222.77 |

Timing ranges overlap: **no robust build speedup is established**. Cold RSS grows about **3.33/2.95 MiB** for BlurHash/LQIP; the warm LQIP median is about one millisecond worse. Those costs remain visible. A fixed 64 KiB kernel does not imply unchanged full-process RSS. [Raw builds](results/blurhash-display-3.1.3/build.json), [summaries](results/blurhash-display-3.1.3/build-summary.json).

## Refreshed cross-tool comparison

Seven rotated/interleaved fresh-Node rounds per corpus compare 3.1.3, published 3.1.2, vite-imagetools 12.0.1 and enhanced-img 1.0.0. Common Vite/Svelte imports are outside every timer; tool loading is included. Each tool uses its native concurrency defaults, not normalized. Integer widths 288/384/480, explicit WebP, `fit=inside` and no preview avoid fractional-height and mixed-codec differences. Imageway uses `q=75`; competitors use their real `quality=75`. Cold removes tool caches; warm immediately repeats in a fresh process. Encoded asset count/byte/SHA multisets must match across every tool, cache state and round.

| Corpus/tool               | Cold ms | Warm ms | Cold RSS MiB | Warm RSS MiB |
| ------------------------- | ------: | ------: | -----------: | -----------: |
| Photos: Imageway 3.1.2    |  361.13 |   59.31 |       397.27 |       221.67 |
| Photos: Imageway 3.1.3    |  363.34 |   60.54 |       396.97 |       221.72 |
| Photos: imagetools        |  318.39 |   50.64 |       243.97 |       202.25 |
| Photos: enhanced-img      |  316.94 |   53.44 |       241.63 |       207.00 |
| Synthetic: Imageway 3.1.2 |  104.87 |   36.83 |       313.48 |       186.00 |
| Synthetic: Imageway 3.1.3 |  104.31 |   36.80 |       308.52 |       186.36 |
| Synthetic: imagetools     |   66.29 |   31.41 |       252.50 |       179.94 |
| Synthetic: enhanced-img   |   67.80 |   32.94 |       252.75 |       184.80 |

Photos emit **72 byte-identical files / 1,324,124 bytes**; synthetic emits **nine / 40,502 bytes**. Imageway remains slower and uses more cold RSS. The small before/after differences do not establish a default-path improvement. [Every result/input manifest](results/blurhash-display-3.1.3/comparison.json), [medians/quartiles/ranges](results/blurhash-display-3.1.3/comparison-summary.json).

## Components, validation and next tranche

Client component/helper files are byte-identical to the published 3.1.2 package. Current complete entries remain **Image 3012 / Picture 3160 JavaScript gzip bytes**, Svelte externalized, plus **220/218 CSS bytes**. The goal of fewer than 2000 gzip bytes and original 1536-byte stretch are still unmet. No client reduction is claimed. [Candidate budgets and source equality](results/blurhash-display-3.1.3/component-budgets.json).

Local: lint, strict TS/Svelte, **269 unit cases**, native independent rebuild, regression JS+CSS budgets and Chromium/WebKit **12 pass / four optional-service skips** pass. Package/exports/types and fresh strict SvelteKit consumers for both hash strategies also pass, including the installed native artifact, exact pixels/PNG and owned output. Final release-source CI/registry status is recorded in REPORT.md only after execution. The supplementary same-store assertions initially made the 1024-input differential test exceed its 30-second deadline on Ubuntu Node22 and Windows Node22/24. It is now partitioned into eight 128-input cases, retaining all fixtures/assertions and the deadline; the test-case count changes 262→269 through batching rather than expanded coverage. The [fixed-source CI](https://github.com/snowly14/svelte-imageway/actions/runs/40240389184) passes every OS/Node job, native rebuild and browsers. No production behavior or benchmark timing changes with this test partition. No paid cloud deployment or HTTP performance is verified here. [Next scoped performance work](../docs/planning/next-performance-tranche.md) prioritizes source decode/worker startup and the component-size gap over further low-impact language rewrites.

## Reproduction

Use Bun for installs/scripts. After `bun install --frozen-lockfile` and `bun run build`, extract the verified 3.1.2 archive to `.local/rust-blurhash/baseline/package` and retain `.local/rust-blurhash/baseline.tgz`. Prepare the pinned photographic corpus and run `bun bench/run.ts --fixtures-only` for synthetic inputs. Archive existing result files before repeating. Run suites serially:

```sh
bun bench/blurhash-display/run.ts
bun bench/blurhash-display/build.ts
bun bench/blurhash-display/compare.ts
bun bench/blurhash-display/confirmation.ts
bun bench/blurhash-display/diagnostic.ts
bun bench/blurhash-display/stores.ts
bun run native:verify
bun run check:budget
bun run check:picture-budget
```

The confirmation is an investigation of the first study's regression, not an interchangeable replacement run. Diagnostics run after timed suites and must not be mixed into their timing tables. Native commands/toolchain are unchanged apart from warnings-as-errors; [contributor instructions](../CONTRIBUTING.md) and [ADR 23](../docs/adr/0023-bounded-blurhash-display-decoding.md) document the numeric bounds, failure behavior and retained reference tests.

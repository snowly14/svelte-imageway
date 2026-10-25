# 3.1.2: native display previews and leaner components — 25 October 2026

The public API, codec settings and complete preview bytes are preserved. Rust now covers ThumbHash inverse DCT, RGBA reconstruction and PNG/checksum assembly. Image/Picture remove some compiled prop/snippet overhead; registered image imports avoid an unnecessary provider lookup. [ADR 22](../docs/adr/0022-native-thumbhash-display-previews.md).

The requested **under-2000-byte complete-entry JavaScript target is not achieved**. The original 1536-byte stretch remains unmet too. No codec, full-build, HTTP or cross-tool leadership is claimed. The dated [3.1 build comparison](IMPROVEMENTS-3.1.md) still has open latency/RSS gaps against imagetools/enhanced-img.

## Machine and protocol

Apple M4, 10 logical CPUs, 16 GiB, Darwin 27 arm64; Node 26.11.1, Bun 1.4.3, Vite 8.3.4, Svelte 5.57.2, Sharp 0.35.5, ThumbHash reference 0.1.1. Kernel/complete-preview measurements use clean product/harness commit **cc3610de1ebbab0e19bd71bfdee6fadf88bd60f2**. Client builds use clean harness commit **058130a70204aebf187827c3d69044d55da7935c**; product sources are unchanged. Raw snapshots retain native codec versions, load and git diff fingerprints. Suites run serially on an uncontrolled desktop, without concurrent local tests/builds. Load at the start of the preview suite is about 1.85/6.64/7.41. No statistical-significance claim is made.

Baseline: verified npm **3.1.1** archive, SHA-256 `ecfff55255330f5722912f3d3c122e58b5fe4beafcaafe1cf78f0c03f92d76d7`. The 24 Kodak source SHA-256s are revalidated against the committed photographic corpus for delivery. The first preview run predates the additional automatic corpus guard in the harness; the client suite uses that guard. Interrupted 23 October pilots are excluded. Final preview/client runs have explicit `complete: true`, with **84/42 samples**. [Corpus receipt](results/lean-preview-3.1.2/corpus-verification.json).

Medians and interpolated Q1–Q3 below describe seven alternating fresh-Node sets. Compare versions within this session: the much busier 23 October session produced higher absolute timings for both versions.

## Components: every helper, JavaScript and CSS

Isolated entries use the same compiler, externalize only Svelte, include all reachable Imageway helpers, and gzip at level 9. CSS is compressed separately and summed. Do not subtract a baseline located in another directory or report: filename-derived compiler identifiers/minifier decisions can change a few bytes.

| Entry   | Before JS | After JS | Before CSS | After CSS | Total before → after |
| ------- | --------: | -------: | ---------: | --------: | -------------------: |
| Image   |      3122 |     3012 |        219 |       220 |          3341 → 3232 |
| Picture |      3262 |     3160 |        217 |       218 |          3479 → 3378 |

JavaScript shrinks about **3.5%/3.1%**; CSS grows one byte in each isolated entry. Regression limits tighten to **3100/3250 JS bytes** and **3330/3480 JS+CSS bytes**. `bun run check:2000` intentionally fails: Image is still **1013 bytes over a strict 1999-byte limit**. The failing stretch is not relabeled as a passing regression gate. [Raw budgets](results/lean-preview-3.1.2/component-budgets.json).

Direct prop access removes some compiler forwarding helpers; fallback snippets use one render anchor. Ordinary registered artifacts skip irrelevant provider lookup/URL parsing. Native callbacks, callback context, error/loading aliases, reactive source changes, cached completion, preload, reduced motion and useful SSR/no-JS markup remain covered. No provider support is removed. A wrapper prototype that increased sizes was discarded.

Seven repeated actual page builds per fixture include Svelte, an ordinary local import, responsive registrations, JS and CSS. All builds within a variant produce identical sizes:

| Fixture | Before JS | After JS | Before CSS | After CSS | Total before → after |
| ------- | --------: | -------: | ---------: | --------: | -------------------: |
| Image   |     18853 |    18354 |        209 |       208 |        19062 → 18562 |
| Picture |     20596 |    20133 |        207 |       208 |        20803 → 20341 |
| Both    |     20934 |    20474 |        248 |       250 |        21182 → 20724 |

Total savings are **500/462/458 bytes** (about 2.6%/2.2%/2.2%). Both-component CSS grows **two bytes**; that cost remains in the total. These are transfer sizes, not a page-speed or hydration-latency measurement. [All builds](results/lean-preview-3.1.2/clients.json). All six before/after fixtures hydrate strictly without recovery/errors, request one identical selected WebP, and remain useful with JavaScript disabled. [Browser receipt](results/lean-preview-3.1.2/client-validation.json).

## Rust inverse DCT and PNG

The server/build-only artifact grows **4570→11111 bytes**, retaining exactly **64 KiB**, no imports/allocator and rejected growth. Separate bounded encoder/decoder cosine tables avoid invalidating each other. P/Q share their basis multiplication while keeping each sum's reference order. Pixel output is at most 4096 bytes; PNG storage is fixed at 4400 bytes and emits at most 4351. Header/length/dimension checks precede pixel writes; returned pixel arrays own their bytes. PNG base64 consumes scratch synchronously into an immutable string. The published package no longer depends on ThumbHash's JS runtime. No browser WASM or consumer compiler is introduced.

The bounded optimized JS control caches cosine/coefficient scratch. Its PNG writer uses fixed typed storage, the same 256-entry CRC table and row-level Adler reductions, and Node base64. Rust therefore competes with an optimized control, not just repeated reference trigonometry/array growth. Both return byte-identical pixels and PNGs. For kernels, source decode and hash preparation are outside timing; 25 warmup batches precede 200 timed 24-photo batches (**4800 calls**). Output is consumed via base64/checksum. Rust includes hash validation/input copy and owned RGBA output for decode; its PNG path base64-encodes the fixed PNG view directly.

| Display path                   | Median µs |      Q1–Q3 µs | First 24-photo batch ms | Incremental initialization ms |
| ------------------------------ | --------: | ------------: | ----------------------: | ----------------------------: |
| Reference JS decode            |     83.19 |   82.58–83.29 |                   5.350 |                         0.166 |
| Bounded cached JS decode       |     32.02 |   31.85–32.06 |                   4.494 |                         0.158 |
| Rust decode                    |     13.88 |   13.85–13.95 |                   1.491 |                         1.042 |
| Reference JS decode + PNG      |    110.09 | 109.86–110.91 |                   6.419 |                         0.168 |
| Bounded cached JS decode + PNG |     40.78 |   40.70–40.89 |                   5.247 |                         0.150 |
| Rust decode + PNG              |     25.33 |   25.32–25.50 |                   1.932 |                         1.046 |

Rust is about **2.31×/1.61×** the optimized JS throughput for decode/decode+PNG here. The reference-to-control gain comes largely from algorithm/scratch reuse. Incremental native initialization costs about **0.9 ms more**, excluding common static imports; this is not total process startup. First batches and initialization stay separate from warm throughput. [Raw samples](results/lean-preview-3.1.2/previews.json), [summaries and ranges](results/lean-preview-3.1.2/summary.json).

## Complete previews, memory and registered imports

Complete previews include source decode, dominant colour, encoding the hash and display-preview creation. There is no persistent preview-cache reuse. Each process measures its first 24-photo batch, warms one batch, then times 72 sequential previews. Every complete preview JSON digest matches the published baseline.

| Strategy     | Before ms/photo (Q1–Q3) | After ms/photo (Q1–Q3) | Median process peak RSS MiB before → after |
| ------------ | ----------------------: | ---------------------: | -----------------------------------------: |
| ThumbHash    |     5.067 (5.034–5.089) |    4.926 (4.926–4.939) |                            133.66 → 131.41 |
| LQIP control |     5.400 (5.352–5.420) |    5.372 (5.317–5.470) |                            134.98 → 135.14 |

Complete ThumbHash improves about **2.8%**, substantially less than the math kernel. The unchanged LQIP control overlaps and its process RSS grows **0.16 MiB**; **no LQIP improvement is established**. Decode process RSS is **144.36/145.19/145.83 MiB** for reference/cached/Rust; PNG is **167.02/142.42/142.11 MiB**. Peaks include setup/JIT and are not production memory forecasts. All ranges remain available.

The headless props control uses 24 registered URL artifacts, an empty provider map, 100 warmup batches and 10000 timed batches (**240000 calls**). Canonical attribute digests match. Median **1.726→0.249 µs/call** (Q1–Q3 **1.720–1.731 / 0.247–0.251**), about 6.9× faster, mostly from avoiding an unnecessary failing URL parse/provider lookup. This synthetic attribute-only microbenchmark establishes no whole-page speedup. Its process RSS grows **127.66→128.53 MiB**; retain the small increase rather than claiming universal memory savings.

## Validation and reproduction

Local gates: lint, strict TypeScript/Svelte (zero errors/warnings), **259 unit tests**, independent native byte-identical rebuild, package/exports/types, both tightened JS+CSS budgets, Chromium/WebKit **12 pass / four optional-service skips**, six strict SSR/client/no-JS benchmark fixtures, and fresh packed strict SvelteKit consumers for both hash preview strategies. Package builds also synchronize the npm README and verify its actual archive payload. The full release-source CI and registry validation status are recorded in REPORT.md after execution.

After `bun install --frozen-lockfile` and `bun run build`, extract the pinned 3.1.1 npm archive to `.local/lean-3.2/baseline/package`, retain it as `.local/lean-3.2/baseline.tgz`, and prepare the pinned photographic corpus using the existing photographic setup. The directory name is an experiment label; the measured version is 3.1.2. Archive existing raw results before rerunning. Run suites serially:

```sh
bun bench/lean-preview/run.ts
bun bench/lean-preview/client.ts
bun bench/lean-preview/verify-client.ts
bun run check:budget
bun run check:picture-budget
bun run native:verify
```

Use `bun scripts/bundle-budget.ts --package-root=.local/lean-3.2/baseline/package` for the isolated baseline, adding `--picture` for Picture. `bun run check:2000` demonstrates the remaining size miss. [Contributor native steps](../CONTRIBUTING.md) and [ADR 22](../docs/adr/0022-native-thumbhash-display-previews.md) cover the new surfaces, safety, license and failure behavior. No new native toolchain step is required.

# 3.1.6: canonical query encoding — 26 October 2026

Canonical query construction now bypasses URI encoding for unreserved ASCII and avoids intermediate filter/map arrays. Full URLs, attributes, signatures and encoded image bytes remain identical. The selected change improves the measured provider and cache workloads, **with higher cache process RSS and slightly larger configured-provider pages**. [ADR 26](../docs/adr/0026-unreserved-canonical-query.md).

## Source, machine and profile

Baseline: verified npm **3.1.5**, archive SHA-256 `09b1a5257093f31a32bb9ebfde22e3b61dd77cc16d6c1268c9cf68cd4a233841`. Candidate timing precedes the 3.1.6 version bump. Initial and final tracked-source patches reproduce their exact recorded diff fingerprints; final source/harness/evidence files are also pinned. Source version/cache fingerprint generation changes normally at release without changing the measured algorithm.

Apple M4, 10 logical CPUs, 16 GiB, Darwin 27 arm64; Node 26.11.1, Bun 1.4.3, Sharp 0.35.5/libvips 8.18.7, Vite 8.3.4, Svelte 5.57.2. Each period records environment and load. This uncontrolled host changes timing markedly: an exploratory identical baseline mapped path ranges from about 18 to 86 µs across periods. Do not compare absolute values with the earlier 3.1.5 study as a controlled regression. Suites run serially; OS caches are not flushed. No significance or universal-production claim.

An untimed baseline V8 profile shows RFC3986 encoding among the largest self-sampled frames. It includes imports/setup and does not profile other native threads or image codecs. Full local profiles are retained by digest; [redacted diagnostic frames and all exploratory results](results/url-serialization-3.1.6/diagnostics.json). Profiler results are excluded from timing tables.

## Protocol and final seven-round study

Seven rotated/reversed fresh-Node rounds, alternating version/control order. 24 requests are prepared outside timing, with first batches and initialization separate. Query kernels warm 100 batches then time 5000 batches/120000calls, consuming complete string lengths. Normalization and provider modes time 2000 batches/48000calls **including JSON serialization of each output**. Their rates are not bare normalizeRequest/getImageProps calls or browser-rendering rates.

The prepared-cache mode performs one real 960px q75 WebP transform and 50 warm hits before timing 5000 sequential memory hits. It retains default ownership copies and memory budget, consuming image bytes. The 155112-byte encoded result must match. This is an API cache lookup, not HTTP, cold encoding or build throughput. Whole-process user+system CPU is supplemental and can include background GC; it is not single-thread CPU time. Process peak RSS includes imports/JIT/native workers.

All complete outputs/digests match within each scenario across versions, controls and rounds. `map-fast` keeps the old array pipeline with the same ASCII fast check; `loop-native` uses the loop with the old encoder. These controls separate the main algorithm effects.

| Final workload/variant   |      Wall µs/op(Q1–Q3) | CPU µs/op | Peak RSS MiB |
| ------------------------ | ---------------------: | --------: | -----------: |
| normalized / before      |   9.919 (9.728–10.308) |    10.151 |       109.31 |
| normalized / after       |    5.056 (4.836–5.256) |     5.256 |       109.31 |
| normalized / map-fast    |    5.493 (5.368–5.814) |     5.667 |       109.31 |
| normalized / loop-native |    9.492 (9.349–9.728) |     9.577 |       109.16 |
| escaped / before         |    3.408 (3.329–3.659) |     3.998 |       109.30 |
| escaped / after          |    2.409 (2.339–2.538) |     2.860 |       109.20 |
| escaped / map-fast       |    2.654 (2.467–3.047) |     2.942 |       109.09 |
| escaped / loop-native    |    3.239 (3.180–3.392) |     3.401 |       109.12 |
| normalize / before       |    4.656 (4.234–5.060) |     5.701 |       110.08 |
| normalize / after        |    4.622 (4.175–4.798) |     5.240 |       110.05 |
| provider / before        | 67.129 (66.275–69.862) |    69.313 |       120.95 |
| provider / after         | 50.614 (49.411–50.998) |    51.344 |       120.91 |
| processor / before       | 50.277 (47.942–54.833) |    76.474 |       190.66 |
| processor / after        | 44.058 (40.327–47.038) |    69.063 |       196.83 |

Normalized serialization improves **9.919→5.056µs**, while the native-encoder loop control remains9.492µs: most gain comes from avoiding unnecessary encoding. Escaped inputs still improve **3.408→2.409µs**. The unchanged normalization body is an effectively unchanged control **4.656→4.622µs**. Provider+JSON is **67.129→50.614µs**. Prepared-cache hits are **50.277→44.058µs**, but process peak RSS increases **190.66→196.83MiB**. Keep that memory cost visible. [All 98 final rows](results/url-serialization-3.1.6/final.json), [full ranges/setup/CPU/RSS](results/url-serialization-3.1.6/final-summary.json).

## Initial experiment and selection check

The first candidate also hoisted the normalization enum-entry table. Its normalization median is **4.656→4.817µs**, with overlapping ranges and no demonstrated benefit. The hoist was removed; both original 98 rows and its exact source patch remain. Its cache peak grows **191.36→199.31MiB** and provider+JSON is **79.889→51.588µs**. Do not pool this period into the final results. [Initial rows](results/url-serialization-3.1.6/measurements.json), [initial summaries](results/url-serialization-3.1.6/summary.json), [initial source](results/url-serialization-3.1.6/initial-source.patch).

A further seven-round selection compares baseline, selected loop/fast (`after`) and a baseline package with only the ASCII fast encoder (`map-package`). The latter is a benchmark-only package copy with the baseline version/pipeline fingerprint; only its encoder changes. All other modules, input/output sizes and admission behavior stay unchanged. This control is not a separately published release.

| Selection workload/variant |      Wall µs/op(Q1–Q3) | Peak RSS MiB |
| -------------------------- | ---------------------: | -----------: |
| provider / before          | 71.393 (69.540–72.533) |       121.00 |
| provider / after           | 51.842 (51.461–53.404) |       121.02 |
| provider / map-package     | 53.218 (52.738–55.540) |       121.03 |
| processor / before         | 45.329 (43.011–49.567) |       189.52 |
| processor / after          | 39.862 (36.193–42.158) |       195.70 |
| processor / map-package    | 45.768 (43.626–47.335) |       191.34 |

The selected cache median improves **45.329→39.862µs**, while map-only is 45.768µs. Map-only uses less peak memory than the selected loop but still grows versus baseline: **189.52 / 195.70 / 191.34MiB** baseline/loop/map-only. The selected loop trades about 6.2 MiB of process peak for the measured cache improvement, preserving ownership and bounds. No new retained cache or manual GC setting is introduced. [All 42 selection rows](results/url-serialization-3.1.6/selection.json), [all ranges](results/url-serialization-3.1.6/selection-summary.json), [map-only patch](results/url-serialization-3.1.6/selection-map-package.patch).

## Complete client pages

Seven alternating builds per plain/configured-local Image/Picture/Both fixture. All serialized provider imports resolve to the same package variant as the component; no baseline accidentally uses the candidate provider. Count every JS/CSS file and sum gzip9 per file including Svelte. Ordinary imported images are actually optimized; asset-byte/SHA multisets match. Twelve final browser fixtures require strict hydration without recovery, selected image-byte equality, one optimized image request and useful no-JS output. Configured-provider pages retain the URI implementation even though these registered imports bypass provider lookup at runtime; URL behavior is independently gated above and in provider tests.

| Page         | JS before→after | CSS before→after | Total before→after |
| ------------ | --------------: | ---------------: | -----------------: |
| Image        |     18354→18351 |          208→208 |        18562→18559 |
| Picture      |     20124→20121 |          208→208 |        20332→20329 |
| Both         |     20467→20465 |          250→250 |        20717→20715 |
| LocalImage   |     21095→21118 |          208→208 |        21303→21326 |
| LocalPicture |     22810→22835 |          208→208 |        23018→23043 |
| LocalBoth    |     23158→23177 |          250→250 |        23408→23427 |

Configured pages grow **23/25/19 bytes**; plain-page differences are tiny pipeline-fingerprint/compiler effects. Generic component/helper source files are unchanged, and isolated Image/Picture remain **2963/3117 JS gzip bytes**, Svelte externalized, plus 220/218 CSS. **Under 2000 bytes and build/RSS leadership remain unmet.** [All 84 client builds](results/url-serialization-3.1.6/clients.json), [twelve browser checks](results/url-serialization-3.1.6/client-validation.json).

## Compatibility, native boundaries and reproduction

The fast check admits only ASCII RFC3986 unreserved characters. A negative-character expression catches trailing line breaks; it does not use a `$`-anchored shortcut. All other input retains encodeURIComponent plus the original punctuation escaping. Tests cover every ASCII/Latin1 character, Unicode, malformed surrogates/URIError, signature omission,1024 seeded unknown/Unicode-key requests and one-time getter/coercion ordering. Existing signature, parser, provider, cache ownership and decode/resource checks remain unchanged. No API migration is required.

No new Rust surface or browser WASM is added. The fixed 64 KiB/13978-byte precompiled preview module and contributor native commands remain unchanged. Source fingerprinting invalidates old representation-cache entries once; no cold-build, HTTP, codec, paid-cloud or market-leadership gain is claimed. Executed local/CI/publication status appears in REPORT.md and the release receipt.

Preserve raw data before repeating. Use Bun, extract the verified 3.1.5 archive to `.local/url-3.1.6/baseline/package`, prepare the existing pinned photographic/synthetic fixtures and run suites serially. The primary runner refuses to overwrite an existing period:

```sh
bun run build
bun bench/url-serialization/run.ts final
bun bench/url-serialization/client.ts
bun bench/url-serialization/verify-client.ts
bun run check
bun run native:verify
bun run check:budget
bun run check:picture-budget
```

To reproduce selection, copy the baseline package to `.local/url-3.1.6/map-fast-package`, apply the documented map-only change, then run `bun bench/url-serialization/run.ts selection`. The initial source patch reproduces the rejected hoist. Fingerprints establish consistency, not release signatures.

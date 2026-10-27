# Sparse native preview work — 27 October 2026

The same verified npm 3.1.7 archive and pinned 24-photo Kodak corpus are used throughout. Machine: Apple M4, 10 logical cores, 16 GiB; Node 26.11.1, Bun 1.4.3. Processes are fresh and suites serialized; OS caches are unflushed. Every row, quartile, startup/first-batch time and process-RSS result remains in `results/sparse-colour-3.1.8/native.json` and `native-summary.json`.

RGBA decoding to at most 32×32 pixels occurs before kernel timing. Colour measures 48,000 complete calls per process; PNG/display measure 12,000. Native measurements include validation, input copies/FFI and immutable string output. Full previews include 72 timed Sharp+colour+hash/display operations after first/warm 24-photo batches. Seven rotated/reversed fresh-process triples require identical complete colours, PNGs and preview JSON.

The optimized JS colour control uses exact cached byte quantization and sparse resets without copying its input. PNG uses cached output/CRC scratch and per-row moduli. The display control retains baseline native decoding and views its pixels without another RGBA copy. These are explicit optimized controls, not claims against every possible JS algorithm.

| Path              | Baseline µs | Optimized JS control µs | Selected Rust µs |
| ----------------- | ----------: | ----------------------: | ---------------: |
| colour            |       2.749 |                   1.578 |            1.230 |
| png               |      11.378 |                   8.311 |            6.690 |
| display           |      24.796 |                  22.164 |           20.098 |
| preview:color     |    4811.845 |                4817.369 |         4815.535 |
| preview:lqip      |    5261.031 |                5265.743 |         5265.223 |
| preview:thumbhash |    4870.236 |                4883.606 |         4864.715 |
| preview:blurhash  |    5042.491 |                5049.426 |         5047.498 |

Colour warm time falls **55.3%**, PNG **41.2%**, and complete ThumbHash display **18.9%** against the baseline. Rust also beats the explicit optimized JS controls. Full Sharp preview differences are tiny and mixed, including regressions; **no complete-preview acceleration is claimed**. Startup and all process-memory costs remain published.

The artifact grows **136 bytes (14702→14838)**, with fixed **65536-byte** memory and no new ABI, import, allocator or browser code. A 2048-byte touched-index array fits the existing 16 KiB stack. Source fingerprints and independent native rebuild gates remain required. [ADR 29](../docs/adr/0029-bounded-sparse-colour-and-row-checksums.md) documents the quantization/checksum proof, fallback and unchanged contributor steps.

## Build profiling and concurrency

Before changing the native or pool architecture, seven cold/warm rounds measure explicit **1/2/4 physical workers** on photographic and synthetic corpora (`baseline.json`). Photographic medians are **961.4/541.6/347.3 ms cold**, about 57.9 ms warm, and **255.4/274.9/308.0 MiB cold RSS**. Four improves throughput while increasing memory. Untimed main-thread CPU and Sharp-promise traces remain separate, with hashes in `diagnostics.json`; asynchronous durations are not native CPU attribution.

The first post-native comparison (`comparison.json`) retains the original pool. Photographic cold baseline/candidate/imagetools/enhanced-img medians are **351.1/349.5/310.0/314.4 ms**, RSS **307.8/308.8/240.6/243.3 MiB**. Warm medians are **57.8/57.7/49.0/52.3 ms**. Synthetic cold **97.3/99.5/64.1/65.7 ms**, warm **35.1/35.3/29.7/32.0 ms**; candidate regresses. Native preview changes do not establish default build or RSS gains.

## Selected finite-build executor

The success-only prototype in `bench/multiplex` uses four virtual leases around one physical Node worker. Three pairs preserve encoded bytes and save roughly 35 MiB, with no clear photographic latency gain and a slow outlier. **This adapter is unshippable**, lacks failure/deadline handling and stays outside the package. Its raw rows remain in `multiplex-probe.json`.

A separate production executor supplies bounded command IDs/admission, hard termination barriers, failed-termination quarantine, bounded startup and fatal-build error handling. It runs only for Vite finite builds. Direct processors, development serving and runtime admission/isolation remain unchanged. Sharp/libvips already executes asynchronous native work, so Node transport removes duplicated worker/module overhead without introducing a Rust FFI wrapper. [ADR 30](../docs/adr/0030-private-vite-native-executor.md).

Seven rotated/reversed fresh-process rounds compare the verified npm 3.1.7 baseline, a frozen candidate package and both competitors (`coalesced.json`, 112 rows). Every cold build clears each tool's cache; warm immediately repeats in a fresh process. Child cwd is the Vite root, including enhanced-img's relative cache. All tools request **integer widths 288/384/480, WebP quality 75, fit inside, no preview**. Every sorted output byte/SHA multiset must match across tools, cache states and rounds: 72 assets / 1,324,124 bytes for photos, 9 assets / 40,502 bytes for synthetic inputs. The raw data is authoritative for byte totals.

| Corpus / tool           | Cold ms | Warm ms | Cold peak RSS MiB |
| ----------------------- | ------: | ------: | ----------------: |
| Photos: baseline        |  370.56 |   61.41 |            309.34 |
| Photos: candidate       |  363.39 |   61.00 |            271.34 |
| Photos: imagetools      |  332.57 |   53.68 |            243.61 |
| Photos: enhanced-img    |  325.62 |   56.69 |            243.53 |
| Synthetic: baseline     |  111.67 |   43.24 |            297.95 |
| Synthetic: candidate    |  102.68 |   37.13 |            265.31 |
| Synthetic: imagetools   |   75.57 |   31.64 |            248.86 |
| Synthetic: enhanced-img |   68.54 |   32.57 |            253.39 |

Photographic cold RSS falls **12.3%**, synthetic **11.0%**. Cold photographic time falls only **1.9%**, with overlapping ranges; no general latency or market-leadership claim is justified. Photo warm RSS slightly grows **220.95→221.69 MiB**. The candidate still trails both tools in build time and cold RSS. All process-wall, startup, quartile and individual peak results remain published; no OS page-cache flush or cold-network timing is claimed.

After-selection concurrency (`coalesced-workers.json`, 84 rows) uses **one physical worker** with 1/2/4 logical Sharp transforms. Photographic cold medians are **963.47/540.82/341.52 ms**, RSS **255.61/262.53/273.34 MiB**. Synthetic cold is **146.61/108.38/92.70 ms**, RSS **232.25/242.95/266.97 MiB**. This is a separate desktop period, not a paired before/after percentage. Four remains the latency choice; one does not become four physical workers merely because concurrency is four.

## Ordinary imports and defaults

A separate default-policy fixture imports all 24 original photos without query directives: unchanged widths, AVIF/WebP/JPEG quality, format pruning, LQIP, and four logical transforms. Both versions preserve every original/optimized output: **156 assets / 19,317,212 bytes**. This measures actual default encoder work, including AVIF; it is not a fair cross-tool quality ranking.

The initial three alternating cold/warm pairs (`coalesced-automatic.json`) give baseline→candidate **5999.73→6238.15 ms cold (+4.0%)**, **126.32→93.32 ms warm** and **438.77→429.53 MiB cold RSS**. The regression remains visible. A separate seven-pair confirmation (`coalesced-automatic-confirmation.json`) gives **5797.11→5692.18 ms cold (−1.8%)**, **87.46→83.83 ms warm**, and **472.55→429.41 MiB cold RSS (−9.1%)**. Timing ranges overlap; the periods do not establish a robust universal speedup. Their different baseline RSS also shows why absolute numbers from separate desktop periods must not be combined. Warm confirmation RSS is **282.50→282.06 MiB**.

## Reproduce and verify

Use Bun and the pinned lockfile; serialize heavy suites. After `bun run build`, run `bun bench/component-props/prepare.ts` to verify/extract the pinned baseline, then preserve a frozen candidate package containing its dist/package metadata. Run `bun bench/component-props/build-workers.ts baseline --output-dir=<fresh-directory>` before architecture edits. `profile-build.ts` accepts `--trace-dir=<empty-directory>`, `--output=<new-json-path>` and optional `--candidate=<package>`. It rejects existing outputs/nonempty trace directories. Native controls use `bun bench/sparse-colour/prepare.ts`, then `run.ts --output-dir=<fresh-directory>`.

Run `bun bench/component-props/build-workers.ts <new-label> --candidate=<frozen-package> --output-dir=<fresh-directory>` for the cross-tool comparison. Add `--workers` for the candidate 1/2/4 logical-transform study. `bun bench/component-props/automatic.ts --study=<new-label> --pairs=7` measures defaults against the fixed candidate location documented in that script. It refuses existing result labels. Preserve all earlier periods. Candidate artifact fingerprints are in `executor-artifacts.json`; original raw rows record the frozen candidate root.

Run the repository lint/type/Svelte/unit/coverage gates, package declarations/exports, actual packed consumers, JS+CSS budgets, native fingerprint/independent rebuild and relevant browser tests before release. No codec quality, AVIF market ranking, cloud/CDN/HTTP or browser-rendering win is inferred from the WebP/native studies.

## Supplemental profiler verification

A post-release benchmark-only correction keeps Node's unique default CPU-profile filenames in separate concurrency directories and explicitly selects thread 0 for main-thread summaries. The original shared explicit filename could let worker exits overwrite one another; the preserved original files contain main Vite frames and no worker entry frames, but their individual worker profiles were lost. No original diagnostic, benchmark row or median is replaced.

`executor-diagnostics.json` profiles the unchanged selected 3.1.8 processing bytes at logical concurrency one/four. Each process retains two distinct CPU profiles (main plus one physical build worker); all image byte/SHA outputs match the timed candidate. Traces show 24 main metadata calls and 72 worker metadata plus encode calls per process. Preloading Sharp and synchronous tracing change startup; these are **untimed diagnostics**, not new latency/RSS medians or native CPU attribution. Duplicate metadata/module work remains a future investigation, with no selected coordinator or metadata-cache shortcut. Reproduce into fresh paths with `bun bench/component-props/profile-build.ts --candidate=packages/svelte-imageway --trace-dir=<empty-directory> --output=<new-json-path>`.

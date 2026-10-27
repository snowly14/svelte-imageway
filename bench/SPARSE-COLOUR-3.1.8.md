# Sparse native preview work — 27 October 2026

Same verified3.1.7 archive and pinned24-photo Kodak corpus; M4/10cores/16GiB, Node26.11.1, Bun1.4.3, serial fresh processes, OS caches unflushed. Protocol and every row/quartile/startup/first-batch/process-RSS result are in results/sparse-colour-3.1.8/native.json and native-summary.json. RGBA<=32x32 photo decoding occurs before kernel timing. Colour includes48000complete calls/process; PNG/display12000. All include validation, native copies/FFI and immutable string output. Full previews include72timed Sharp+colour+hash/display operations after first/warm24-photo batches. Complete outputs/PNGs/preview JSON must be identical across seven rotated/reversed fresh-process triples. JS colour uses exact cached byte quantization and sparse resets with zero input copy; PNG uses cached output/CRC scratch and per-row moduli. Display control keeps baseline native decoding and uses a view of its pixels, without an extra RGBA copy.

| Path              | Baseline µs | Optimized JS control µs | Selected Rust µs |
| ----------------- | ----------: | ----------------------: | ---------------: |
| colour            |       2.749 |                   1.578 |            1.230 |
| png               |      11.378 |                   8.311 |            6.690 |
| display           |      24.796 |                  22.164 |           20.098 |
| preview:color     |    4811.845 |                4817.369 |         4815.535 |
| preview:lqip      |    5261.031 |                5265.743 |         5265.223 |
| preview:thumbhash |    4870.236 |                4883.606 |         4864.715 |
| preview:blurhash  |    5042.491 |                5049.426 |         5047.498 |

Colour warm time falls55.3%; PNG41.2%; complete ThumbHash display18.9%. Selected Rust beats the explicit optimized JS controls; these are not claims against every possible JS algorithm. Full Sharp preview differences remain tiny and mixed; no complete-preview acceleration is claimed. Preserve all regressions/startup costs. The artifact grows136bytes (14702->14838), fixed65536-byte memory, no new ABI/import/allocator or browser code. A2048-byte local touched-index array fits the existing16KiBstack. Source/manifest and independent native rebuild gates remain required. ADR29 explains the exact quantization/checksum proof, fallback and contributor steps.

Before native edits, measure seven cold/warm rounds with explicit1/2/4workers on photographic/synthetic corpora. Photographic medians1/2/4:961.4/541.6/347.3ms cold, ~57.9ms warm, peakRSS255.4/274.9/308.0MiB cold. More workers improve throughput while raising memory; no worker default was changed for this study. Diagnostic main-thread CPU/Sharp promise tracing is separate, hashes retained; async promise durations do not isolate native CPU.

Final default-worker WebPq75/288,384,480/no-preview comparison has seven rotated rounds, empty tool caches then fresh-process warm repeat, explicit child cwd for competitor cache isolation, identical asset SHA/byte multisets. Photographic baseline351.1ms/307.8MiB vs candidate349.5/308.8 vs imagetools310.0/240.6 vs enhanced-img314.4/243.3 cold; warm57.8/57.7/49.0/52.3ms. Synthetic cold97.3/99.5/64.1/65.7ms, warm35.1/35.3/29.7/32.0ms. Synthetic candidate regresses. None bypasses preview work; these native edits do not improve default build leadership/RSS, and the gap remains open. All rows and summaries are retained separately from native kernel results.

A three-pair, success-path-only experiment shares four logical jobs in one Node worker, preserving exact encoded bytes. It saves roughly35MiB with no clear photographic latency gain and one slow outlier. Deadline/failure isolation is deliberately absent. The adapter is unshippable, remains in bench/multiplex and ignored benchmark clones, and is not part of the package. A production change requires separate bounded RPC, fatal-stop/deadline/isolation tests and honest paired throughput/RSS evidence before selection.

Reproduce with Bun after build and pinned baseline preparation: bench/component-props/build-workers.ts baseline; profile-build.ts; bench/sparse-colour/prepare.ts and run.ts; then build-workers.ts comparison. Use a fresh result destination/label instead of overwriting data. Baseline quality and integer widths are shared with competitors; no AVIF, cloud, CDN, HTTP or universal market-leadership claim is made.

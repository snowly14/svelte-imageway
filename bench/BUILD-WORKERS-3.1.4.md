# 3.1.4: private shared build inputs — 26 October 2026

The highest-confidence win is **lower photographic cold-build process RSS**, with byte-identical images. Finite builds copy an encoded source once into a private exact-sized shared backing store and reuse it across worker variants. The public API, worker count, codec settings, runtime admission, decoding/resource limits and fixed Rust preview kernel remain unchanged. [ADR 24](../docs/adr/0024-private-shared-build-inputs.md).

**A general build speedup is not established.** Timing is noisy, one exploratory photographic period regresses slightly, and the corrected synthetic medians regress. Both studies are retained. Cross-tool build/RSS leadership and the complete-entry goal below 2000 gzip bytes remain open.

## Machine, source and protocol

Baseline is the verified npm **3.1.3** archive, SHA-256 `50d85026796f70e6ccab5a89be785e0059ec157da8a237019d3da867bf2ea63a`, extracted unchanged. The candidate was measured before the patch version bump; its benchmark environment therefore still labels the package 3.1.3. The release changes that label to 3.1.4; the measured processor source is pinned by the result manifest. Preview/component/codec sources are unchanged.

Apple M4, 10 logical CPUs, 16 GiB, Darwin 27 arm64; Node 26.11.1, Bun 1.4.3, Sharp 0.35.5/libvips 8.18.7, Vite 8.3.4, Svelte 5.57.2, imagetools 12.0.1, enhanced-img 1.0.0. Each suite records load averages and full environment. A concurrent foreground workload was present; no unrelated processes were stopped. Timing varied considerably between periods. **Do not compare these absolute milliseconds with 25 October as a controlled regression.** RSS is process peak, including worker threads; it is not per-worker memory or a production forecast.

Suites run serially. Each child is a fresh Node process. Tool caches are removed for cold builds and retained for an immediate warm repeat; OS/page caches are not flushed. `buildMs` begins before tool import and ends before asset validation, with common Vite/Svelte imports outside every tool timer. Process wall time additionally includes startup/verification. Medians and interpolated quartiles are descriptive, without a significance claim. All raw files, counts, byte identities, source/harness fingerprints and known limitations are retained.

## Before changes: explicit workers 1 / 2 / 4

Seven rotated/reversed rounds per corpus, three integer widths 288/384/480, WebP q75, fit=inside, no preview. Each configuration uses frozen npm 3.1.3. Both corpora must produce identical asset-byte/SHA multisets across configurations, repeats and cache states. The worker default remains unchanged: reducing workers would trade photographic throughput for memory.

| Configuration              |           Cold ms (Q1–Q3) |        Warm ms (Q1–Q3) | Cold / warm peak RSS MiB |
| -------------------------- | ------------------------: | ---------------------: | -----------------------: |
| photographic: one worker   | 4420.55 (4222.14–5100.70) | 285.52 (268.60–317.51) |          281.12 / 220.73 |
| photographic: two workers  | 2506.10 (2121.40–2701.10) | 268.74 (244.76–316.77) |          327.53 / 220.33 |
| photographic: four workers | 1718.57 (1488.53–1830.01) | 296.16 (292.55–330.30) |          394.80 / 220.72 |
| synthetic: one worker      |    830.54 (783.06–843.57) | 201.07 (192.87–208.93) |          230.80 / 185.33 |
| synthetic: two workers     |    582.90 (567.90–639.44) | 200.21 (192.65–217.49) |          256.62 / 185.11 |
| synthetic: four workers    |    554.88 (501.67–569.31) | 191.95 (180.93–214.75) |          302.28 / 185.16 |

[Every baseline row](results/build-workers-2026-10-26/baseline.json), [all ranges and process wall times](results/build-workers-2026-10-26/baseline-summary.json).

Untimed Sharp instrumentation records **24 main-thread metadata calls, 72 worker metadata calls and 72 worker encodes** for the 24-photo responsive workload. Worker jobs submit **46,182,915 encoded input bytes**, versus **15,394,305 unique source bytes**. This counts submitted bytes; it does not assert that all are simultaneously resident or that each metadata call decodes a complete image. Main-thread samples mostly wait on asynchronous native work. Promise durations overlap and include instrumentation overhead; neither those durations nor main-thread V8 samples separate native decode/resize/encode CPU. [Full diagnostic events and profile digests](results/build-workers-2026-10-26/diagnostics.json).

The selected change removes redundant structured-clone payload copies. It does not skip worker metadata/security checks or predecode everything into larger raw buffers. A Rust/WASM wrapper would still need host/worker copies here; the profile does not justify replacing native crypto or the Sharp/libvips codec stack. There is **no new Rust-language speedup claim**. Existing native preview code, fixed 64 KiB memory, fingerprint and contributor toolchain remain unchanged.

## Corrected comparison: seven rounds per tool/corpus

Frozen npm 3.1.3 versus the candidate, imagetools and enhanced-img, using each native default concurrency. Explicit WebP, integer widths and fit=inside avoid codec/resize differences. Imageway uses `q=75`; competitors use `quality=75`. All children run inside their own Vite roots so relative enhanced-img caches are actually cleared. Photos emit **72 identical files / 1,324,124 bytes**; synthetic emits **nine / 40,502 bytes**. Byte/SHA multisets match across every tool, round and cache state.

| Configuration              |           Cold ms (Q1–Q3) |        Warm ms (Q1–Q3) | Cold / warm peak RSS MiB |
| -------------------------- | ------------------------: | ---------------------: | -----------------------: |
| photographic: baseline     | 1501.93 (1348.03–1632.64) | 298.87 (281.99–304.52) |          394.23 / 221.03 |
| photographic: candidate    | 1328.08 (1320.51–1402.08) | 254.29 (241.50–301.63) |          305.42 / 220.47 |
| photographic: imagetools   | 1062.46 (1035.22–1099.15) | 203.99 (195.56–213.66) |          236.94 / 201.30 |
| photographic: enhanced-img | 1112.78 (1046.90–1148.66) | 237.91 (228.70–254.35) |          237.11 / 206.00 |
| synthetic: baseline        |    459.71 (430.37–470.31) | 178.64 (141.17–198.49) |          304.83 / 184.95 |
| synthetic: candidate       |    484.70 (422.82–505.05) | 187.28 (163.73–198.51) |          303.20 / 184.94 |
| synthetic: imagetools      |    253.48 (227.31–269.08) | 166.41 (137.41–172.30) |          245.67 / 179.28 |
| synthetic: enhanced-img    |    254.51 (247.12–283.61) | 135.67 (132.57–165.46) |          248.92 / 184.28 |

Photographic cold RSS falls **394.23→305.42 MiB**, about **88.81 MiB / 22.5%**. The exploratory period independently sees **394.94→307.31 MiB**. This is the strongest result. Warm photographic RSS is effectively unchanged. Corrected photographic cold/warm medians are 11.6%/14.9% lower, but the original exploratory photographic cold/warm medians are slightly worse; the timing periods cannot support a broad speedup claim.

Corrected synthetic medians are **5.4% slower cold / 4.8% slower warm**, with overlapping quartiles and only about **1.63 MiB** lower cold RSS. Retain this cost. Imageway still trails both competitors for cold time and RSS; synthetic warm leadership is also unmet. [Corrected raw data](results/build-workers-2026-10-26/shared-source-corrected.json), [all quartiles/ranges/process wall times](results/build-workers-2026-10-26/shared-source-corrected-summary.json).

### First exploratory period and fairness correction

The first new orchestrator omitted the child's working directory. Imageway and explicitly configured imagetools use caches under their Vite roots; enhanced-img's default imagetools cache uses `process.cwd()`. Deleting each root cache therefore left enhanced-img's actual repository-level cache populated after its first run. **Those enhanced-img cold samples are invalid for ranking.** The previous 3.1.3 comparison already sets child cwd correctly and is unaffected.

The fix adds `cwd: root` to the new orchestrator and repeats the entire study under a new result name. All first-period rows remain available; they are not pooled or silently replaced. Baseline/candidate exploratory figures, including regressions, are:

| Configuration           |           Cold ms (Q1–Q3) |        Warm ms (Q1–Q3) | Cold / warm peak RSS MiB |
| ----------------------- | ------------------------: | ---------------------: | -----------------------: |
| photographic: baseline  | 1275.54 (1243.78–1392.54) | 248.52 (232.27–268.27) |          394.94 / 220.78 |
| photographic: candidate | 1282.42 (1231.22–1350.81) | 252.09 (243.66–256.12) |          307.31 / 220.55 |
| synthetic: baseline     |    148.51 (141.42–441.72) |   47.85 (45.20–156.02) |          305.31 / 186.00 |
| synthetic: candidate    |    151.23 (140.94–442.52) |   65.14 (43.43–167.77) |          302.02 / 185.73 |

[Original exploratory rows](results/build-workers-2026-10-26/shared-source.json), [original summaries](results/build-workers-2026-10-26/shared-source-summary.json), [explicit study validity notes](results/build-workers-2026-10-26/study-status.json). Original synthetic warm candidate time is **36.1% worse** here; it remains visible. Broad timing spreads and changing host load prohibit a universal throughput conclusion.

## Ordinary default imports: three alternating pairs

All 24 photos use ordinary imports with unchanged default widths, AVIF/WebP/JPEG encoding, quality, format pruning, LQIP and concurrency. Original image assets remain emitted. Each cold build clears both variant/preview caches; warm repeats in a fresh process. All **156 original/optimized assets / 19,317,212 bytes** must match by byte/SHA multiset. This is a before/after default-policy comparison, not equal-quality competitor data.

| Configuration |              Cold ms (Q1–Q3) |        Warm ms (Q1–Q3) | Cold / warm peak RSS MiB |
| ------------- | ---------------------------: | ---------------------: | -----------------------: |
| baseline      | 29005.33 (27808.91–29865.91) | 398.01 (385.16–406.48) |          515.55 / 279.62 |
| candidate     | 28160.92 (28065.92–28476.79) | 379.90 (370.78–389.92) |          428.94 / 277.23 |

The default workload also reduces cold process peak RSS. Three pairs are limited evidence: the third candidate cold run is slower than its baseline, and neither a large codec gain nor market leadership follows. The much larger cold cost remains in processing uncached variants; these data do not separate native decode/resize/encode CPU. Preview algorithms and outputs are unchanged. [Every default-import result](results/build-workers-2026-10-26/automatic.json), [ranges and counts](results/build-workers-2026-10-26/automatic-summary.json).

## API, components, native steps and validation

Only finite-build prepared snapshots change representation. Runtime snapshots and ordinary `process()` retain their original storage behavior. Callers never receive a writable alias; views with unrelated backing bytes are copied into exact-sized storage before admission. Tests use actual concurrent compiled workers and compare outputs against the reference pipeline, mutate caller and output bytes, check runtime ordinary backing storage, reject oversized input and verify failure recovery. Queue byte accounting and hard terminating worker deadlines remain unchanged.

There are **no new native build steps**. The existing Rust artifact stays 13,978 bytes, fixed 65,536-byte non-growable memory, no imports, no browser WASM and no consumer Rust toolchain. `bun run native:verify` independently rebuilds it using the existing pinned contributor toolchain.

Client sources are unchanged. Image/Picture remain **3012/3160 JS gzip bytes**, Svelte externalized, plus **220/218 CSS**. No client-size, HTTP, paid-cloud, perceptual-quality or codec-language win is claimed. The under-2000-byte complete-entry target remains unmet. Final executed checks and exact release/registry status are recorded in REPORT.md and the release receipt rather than assumed here.

## Reproduce

Use Bun. Preserve existing raw files before rerunning; the new orchestrators refuse to overwrite studies. Prepare the pinned Kodak corpus using the photographic instructions and deterministic synthetic fixtures with `bun bench/run.ts --fixtures-only`. Extract the verified 3.1.3 archive to `.local/build-workers/baseline/package` and retain it as `.local/release-3.1.3/svelte-imageway-3.1.3.tgz`; each orchestrator verifies its SHA. Then build the candidate and run suites serially:

```sh
bun install --frozen-lockfile
bun run build
bun bench/build-workers/run.ts baseline
bun bench/build-workers/profile.ts
bun bench/build-workers/run.ts shared-source-corrected
bun bench/build-workers/automatic.ts
bun run check
bun run native:verify
bun run check:budget
bun run check:picture-budget
```

For baseline profiling the preload logs Sharp calls in each worker; it is excluded from timed runs. The exploratory cwd error is documented above and should not be reintroduced. The final manifest pins the source and evidence files; fingerprints check consistency, not cryptographic release signatures.

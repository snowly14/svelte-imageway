# 3.1.10 measurements — 1 November 2026

This is source validation and local benchmarking, not a publication receipt. The workspace uses Node 26.11.1, Bun 1.4.3, Apple M4 (10 logical CPUs, 16 GiB), pinned dependencies and Rust 1.99.0. Heavy suites run serially, OS caches are not flushed. Raw samples include regressions and a host-validation pilot that is not used for final claims.

## Bounded Rust PNG work

[ADR 33](../docs/adr/0033-sliced-png-crc.md) selects slicing-by-four CRC. At 32×32, seven alternating within-process medians are old Rust **9.982 µs**, selected Rust **4.551 µs**, optimized JS **8.461 µs**, with host validation/input copy/owned output included for Rust. A separate manual-byte JS ablation gives **9.925/4.486/8.436 µs**. Setup/artifact retrieval is separate and not comparable as compilation time. Complete ThumbHash previews on the pinned 24-photo corpus regress slightly **4.95593→4.96143 ms**; RSS **131.0625→130.9531 MiB**. Their digests match. WASM grows **14838→17983 bytes**, fixed memory stays **64 KiB**, with no browser WASM or consumer compiler. All 1024 dimensions and zero/white/random PNG bytes match the independent reference. The earlier delayed-Adler prototype was rejected (<1% difference, larger module); its files remain local.

## Build work and remaining gaps

[Lazy XML parser study](../docs/adr/0034-lazy-svg-validator.md) compares immediately preceding local snapshots. Photo cold/warm **353.02/60.31→344.96/58.79 ms**; synthetic **98.37/37.32→94.78/35.52 ms**. First SVG validation pays deferred module load **0.631→1.730 ms**; combined import-plus-first validation is **3.065→2.725 ms**. These are local descriptive measurements with overlapping ranges, not a general speedup. The synthetic cold RSS rises slightly. Earlier [signature study](SIGNATURE-SNIFF-2026-11-01.md) includes its own synthetic cold/RSS regression and compares 3.1.9 directly; periods are not interchangeable.

The final explicit logical concurrency study compares the actual npm 3.1.9 package to selected 3.1.10, one physical native executor in both, WebP q75 at exact 288/384/480 widths. Seven rotated/reversed rounds each include cold cache deletion and a fresh-process warm repeat. All encoded-byte/SHA multisets match. See `results/selected-workers-2026-11-01/` for all cold/warm/process/RSS samples.

| Corpus    | Logical tasks | Before cold ms | After cold ms | Before RSS MiB | After RSS MiB |
| --------- | ------------: | -------------: | ------------: | -------------: | ------------: |
| Photos    |             1 |         975.53 |        973.74 |         251.33 |        251.34 |
| Photos    |             2 |         543.91 |        545.68 |         258.94 |        258.83 |
| Photos    |             4 |         349.00 |        341.91 |         268.44 |        270.59 |
| Synthetic |             1 |         148.20 |        146.86 |         232.08 |        230.38 |
| Synthetic |             2 |         109.57 |        106.97 |         244.39 |        243.86 |
| Synthetic |             4 |          94.53 |         91.45 |         267.36 |        267.81 |

Four tasks preserve the best sampled throughput while increasing photo peak RSS; no concurrency default is changed. Both imagetools/enhanced-img remain ahead in the separate equal-output lazy-parser comparison: photo cold **316.21/318.98 ms**, synthetic **67.28/68.69 ms**, with lower RSS. No build/RSS leadership is established.

## Client size

Isolated complete Image/Picture entries shrink **2957→2951 / 3103→3097 JS gzip bytes**, Svelte externalized, plus **206 CSS bytes each**. The provider ladder is already sorted/nonempty; using the last width avoids a second maximum scan. Boundary/input-ownership tests preserve format limits. The controlled component-only period saves **8/6/8 total page gzip bytes**; all data remain in [its report](COMPONENT-WIDTH-MAX-2026-11-01.md).

Final seven-pair real Image/Picture/Both builds against the actual registry baseline, including Svelte and every JS/CSS file, give **18530→18523 / 20304→20296 / 20633→20627 total gzip bytes**. All image byte/SHA multisets match and all six strict hydration/no-JS fixtures pass. Package roots, processing URL fingerprints and minified symbol ordering differ between periods; compare within each pair and do not invent compression savings across studies. Raw final data: `results/selected-client-2026-11-01/`. **Under 2000 JS gzip bytes remains unmet.**

## Valid-cache upgrades and Edge correctness

[ADR 35](../docs/adr/0035-policy-bound-edge-cache.md) fixes cached responses bypassing newly stricter input/pixel/output policies using an owned-config fingerprint and edge-v2 namespace. Identical-policy hits remain. These are stubbed/portable service tests, not a paid deployment or HTTP latency claim.

[ADR 36](../docs/adr/0036-reviewed-node-cache-and-edge-namespace.md) preserves only exact reviewed Node output compatibility. From the verified actual npm 3.1.9 archive, seven unaliased trials take **5570.33 ms** on the first upgraded build and double transform/preview entries **198/24→396/48**. A separate seven-trial compatible period gives first upgrade **84.15 ms** and subsequent warm **85.66 ms**, keeping all 222 files/mtimes and 156 image URLs/bytes unchanged. These are local valid-cache upgrades with matching source, codecs, policy and expiry, not cold builds. Additional hot pairs preserve every one of 158 outputs, including JS/HTML, before and after the 3.1.10 version bump. An actual old/new Worker-module proof demonstrates legacy Edge misses even with the same compatible Node marker. Unknown source trees invalidate; nested TS/WASM and symlink guards are tested. All raw data: `results/cache-split-2026-11-01/`.

No image quality/output-weight improvement, general preview speedup, HTTP performance or market leadership is claimed. Native ABI, SSR/no-JS behavior, resource limits and public component API remain stable. Exact-source CI, final package/browser consumers and registry archive verification are release gates, not implied by these local benchmarks.

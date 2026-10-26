# 3.1.5: lazy client lookup — 26 October 2026

The selected changes remove unnecessary registry allocation and provider hostname parsing, preserving complete attributes and APIs. Isolated component entries shrink modestly; **the actual Image page grows eight total gzip bytes**. The complete-entry goal below 2000 bytes remains unmet. [ADR 25](../docs/adr/0025-lazy-client-lookups.md).

## Machine and source

Pinned npm 3.1.4 baseline archive SHA256 `26385d08383d55d8d147a1dbc14d69b70ac6cd35946299efeeef2c63e9431cd6`. The candidate was measured before its 3.1.5 version bump; the environment still labels it 3.1.4. Final source/evidence hashes are retained separately. The benchmark input preparation received a TypeScript contextual-type repair after measurement; it changes no timed operation, input or output.

Apple M4,10 logical CPUs,16 GiB,Darwin 27arm64; Node 26.11.1,Bun 1.4.3,Vite 8.3.4,Svelte 5.57.2,Sharp 0.35.5/libvips8.18.7. This is a single uncontrolled desktop; all heavy local suites run serially, OS caches unflushed. The raw environment retains load averages and exact versions. Medians/quartiles are descriptive, without significance or universal browser-speed claims.

## Complete headless attributes, Node benchmark

Seven rotated/reversed fresh-process rounds for five scenarios, alternating version order.24 inputs are prepared outside timing; incremental imports/preparation and first batch are reported separately. After 100 warm batches,10000 batches time 240000calls. Consume src/srcset/style lengths. Canonical complete output JSON must match across all versions and rounds. Includes validation, lookup,srcset,style and owned output object. **These are Node getImageProps timings, not browser rendering, HTTP or encoding rates.**

| Scenario   |   3.1.4 µs/call(Q1–Q3) |   3.1.5 µs/call(Q1–Q3) |
| ---------- | ---------------------: | ---------------------: |
| relative   |    1.638 (1.611–1.655) |    0.246 (0.245–0.248) |
| absolute   |    0.357 (0.352–0.359) |    0.250 (0.247–0.252) |
| registered |    0.268 (0.266–0.278) |    0.264 (0.261–0.269) |
| mapped     | 18.308 (18.184–18.421) | 18.368 (18.296–18.569) |
| empty-map  |    1.650 (1.626–1.656) |    1.654 (1.634–1.664) |

The providerless relative path improves about 6.7× here by avoiding a thrown/caught URL parse. Absolute URLs improve too. Registered, mapped-provider and explicitly empty-map controls remain effectively unchanged; mapped and empty-map medians regress slightly. A configured map retains parsing and its exact hostname/wildcard contract. Default generated configuration now omits the empty map. Already registered artifacts still bypass providers.

Plain/mapped/empty-map first reads previously initialized both registration maps; now only actual registration creates them. The raw booleans verify absence/presence around the first batch. This is an allocation-count behavior, **not an established process-RSS reduction**. Full process RSS includes shared imports/JIT; every initialization, first-batch, process peak and sample remains in [raw results](results/client-lookup-3.1.5/props.json) and [summaries](results/client-lookup-3.1.5/props-summary.json).

## Complete isolated entries, Svelte externalized

| Entry   | Paired3.1.4 JS/CSS gzip | 3.1.5 JS/CSS gzip | Total before→after |
| ------- | ----------------------: | ----------------: | -----------------: |
| image   |                3021/219 |          2963/220 |          3240→3183 |
| picture |                3171/216 |          3117/218 |          3387→3335 |

All reachable chunks/helpers count, gzip level 9. Different package paths change compiler identifiers: the independently located3.1.4 release gate was3012/3160JS bytes, while this extracted baseline is3021/3171. Use the paired table above, not a silent baseline substitution. CSS grows1/2bytes here. Current candidate entries are **2963/3117JS gzip bytes**, plus220/218CSS. The under2000-byte target is still unmet. Regression limits tighten separately to3000/3150JS and3250/3400total.

## Actual application pages, including Svelte

Seven alternating fresh-process builds per Image/Picture/Both scenario, ordinary pinned photographic import, shared compiler and SSR/hydration entry. Count every emitted JS and CSS file, summing gzip9 per file. No timing claim. All image byte/SHA multisets must match. Final six fixtures additionally verify strict hydration without recovery, one selected image request, matching bytes, noJS/console/HTTP errors and useful images without JavaScript.

| Page    | JS before→after | CSS before→after | Total before→after |
| ------- | --------------: | ---------------: | -----------------: |
| Image   |     18346→18355 |          209→208 |        18555→18563 |
| Picture |     20127→20122 |          207→208 |        20334→20330 |
| Both    |     20468→20465 |          248→250 |        20716→20715 |

The Image page grows 8 total bytes despite its smaller isolated entry. Picture saves 4 bytes and Both saves 1 byte, with 2 extra CSS bytes in Both. These differences are effectively tiny; this is **not a large full-page bundle win**. Registry registration remains reachable on ordinary-import pages, so its initialization code cannot disappear as in a resolution-only entry. All 42 build rows and six final browser checks remain [available](results/client-lookup-3.1.5/clients.json), with [validation](results/client-lookup-3.1.5/client-validation.json).

## Rejected lifecycle prototypes and limits

A bit-packed lifecycle diagnostic grew isolated Image/Picture by 13/10 bytes. Removing explicit Boolean conversions saved only 6/2 bytes relative to the lazy-registry-only prototype. Both were rejected; final lifecycle sources, callbacks/snippets,preload,reduced-motion and native attributes remain unchanged. [Diagnostic numbers](results/client-lookup-3.1.5/rejected.json).

There is no new Rust surface or browser WASM. The existing 13978-byte precompiled Rust artifact and fixed 64 KiB memory remain byte-identical; contributor commands do not change. Native verification uses the pinned 1.99.0 compiler and installed wasm target. Source fingerprinting changes the generated processing revision, invalidating prior representation-cache entries once; no warm-build/codec/HTTP gain is claimed. Earlier build/RSS gaps remain documented in 3.1.4.

Local lint,strictTS/Svelte,272 tests,native independent rebuild,package/exports/types,JS+CSS budgets and Chromium/WebKit 12 pass / 4 optional-service skips pass. Publication and exact-sourceCI status are recorded in REPORT.md after execution. No paid-provider production verification is claimed.

## Reproduction

Use Bun, build first, extract the verified 3.1.4 archive to `.local/client-3.1.5/baseline/package`, retain its archive at `.local/release-3.1.4/svelte-imageway-3.1.4.tgz`, and prepare the pinned photographic corpus. Preserve raw results before repeats. Run serially:

```sh
bun run build
bun bench/client-lookup/run.ts
bun bench/client-lookup/client.ts
bun bench/client-lookup/verify-client.ts
bun run check:budget
bun run check:picture-budget
bun run native:verify
```

`run.ts` refuses to overwrite its existing study. Preserve the client study before running it again. Native/consumer steps remain in CONTRIBUTING.md. Hashes prove source/evidence consistency, not cryptographic release signatures.

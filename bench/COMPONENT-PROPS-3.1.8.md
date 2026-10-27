# Component attribute work — 27 October 2026

Baseline: verified npm3.1.7 tar SHA256 dd67a03d7c7a27dba607a838d1460117710e8a3fecca2ff0bf16cd89e60a2535. Apple M4/10logical CPUs/16GiB, Node26.11.1/Bun1.4.3, dependencies pinned in bun.lock. Single active desktop; suites serialized; no OS-cache flush. Full environments, medians/quartiles and all original rows are in results/component-props-3.1.8. Headless measurements use1000warm24-input batches then240000calls (24000mapped), consume src/style/srcset and require identical complete canonical attributes. Seven alternating fresh-process triples compare baseline, allocation/style/size-control with original provider algorithm, and selected code. These are API/SSR timings, not browser rendering speed.

| Headless scenario | Baseline µs | Allocation control µs | Selected µs |
| ----------------- | ----------: | --------------------: | ----------: |
| relative          |      0.2470 |                0.1607 |      0.1596 |
| absolute          |      0.2484 |                0.1575 |      0.1565 |
| empty-map         |      1.5815 |                1.4397 |      1.4665 |
| registered        |      0.2708 |                0.1817 |      0.1794 |
| mapped            |     12.3791 |               12.3540 |      8.4627 |
| shorthand         |      0.7870 |                0.6018 |      0.6016 |
| art               |      0.4632 |                0.3248 |      0.3246 |

Actual SSR fixtures contain24Image/24Picture/24pairs, snippets, placeholders, native attributes, priority preload and size shorthand. Seven alternating fresh-Node pairs after100warm App renders time500complete renders, consuming allocated HTML. HTML must match after normalizing only the documented old scoped-class/new shared-marker identity. See ssr.json/summary; first period with scoped CSS remains in original-css. First combined-node-render medians are not per-image or browser timings.

Actual client builds: seven alternating pairs per Image/Picture/Both, ordinary photo imports, all JS/CSS and identical image SHA/byte multisets. Strict SSR hydration (recovery disabled), one selected image request and useful no-JS markup are checked in client-validation.json. Image18551->18549, Picture20314->20323, Both20691->20650 total gzip bytes. Retain Picture's9-byte regression. Root-import headless-only builds emit zero CSS and1764JSgzip bytes on both versions. Original scoped CSS client results remain in original-css; no period is overwritten.

Independent same-workspace isolated entries: Image2953->2983JSgzip, CSS220->206, total3173->3189. Picture3096->3131JS, CSS218->206,total3335->3337. Extracted archive identity/path fingerprints produce different paired baselines2965/3110JS and218/215CSS; do not mix those with same-workspace gates. The JS-size regression and unmet2000-byte goal remain explicit. Existing3000/3150JS and3250/3400total regression budgets remain enforced. No lazy/server chunk hides code from these counts.

A standalone component filtering helper, tuple return and Object.assign return were rejected after increasing size or losing the sampled speed gain. Diagnostic source/size logs are preserved under .local/component-3.1.8 and will be archived with the final evidence. Null-prototype sizes fixes constructor/toString/**proto** shorthand without changing supported tokens. Svelte metadata moves out of valid headless options; no public API migration or consumer env declaration is required. ADR28 describes the runtime-only CSS declaration cleanup and CSS side-effect marking.

Reproduce with Bun: build; verify/extract the pinned baseline using bench/component-props/prepare.ts; run attributes.ts, ssr.ts, client.ts and verify-client.ts serially into a fresh result location (preserve existing data). Fixture sources and controls are versioned. Source fingerprints and all startup/RSS data remain in the raw files.

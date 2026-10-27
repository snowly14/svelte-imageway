# Component attribute work — 27 October 2026

Baseline: verified npm 3.1.7 archive, SHA-256 `dd67a03d7c7a27dba607a838d1460117710e8a3fecca2ff0bf16cd89e60a2535`. Apple M4, 10 logical CPUs, 16 GiB; Node 26.11.1 and Bun 1.4.3; dependencies pinned in bun.lock. One active desktop, serialized suites, no OS-cache flush. Full environments, medians/quartiles and original rows are in `results/component-props-3.1.8`.

Headless tests warm 1000 batches of 24 inputs, then time 240,000 calls per scenario (24,000 for mapped providers). They consume src/style/srcset and require identical complete canonical attributes. Seven alternating fresh-process triples compare the baseline, an allocation/style/size control retaining the old provider algorithm, and selected code. These are API/SSR timings, not browser rendering speed.

| Headless scenario | Baseline µs | Allocation control µs | Selected µs |
| ----------------- | ----------: | --------------------: | ----------: |
| relative          |      0.2470 |                0.1607 |      0.1596 |
| absolute          |      0.2484 |                0.1575 |      0.1565 |
| empty-map         |      1.5815 |                1.4397 |      1.4665 |
| registered        |      0.2708 |                0.1817 |      0.1794 |
| mapped            |     12.3791 |               12.3540 |      8.4627 |
| shorthand         |      0.7870 |                0.6018 |      0.6016 |
| art               |      0.4632 |                0.3248 |      0.3246 |

## SSR and client pages

Actual SSR fixtures contain 24 Images, 24 Pictures or 24 pairs, with snippets, placeholders, native attributes, priority preload and size shorthand. Seven alternating fresh-Node pairs warm 100 App renders, then time 500 complete renders while consuming the allocated HTML. HTML must match after normalizing only the documented old scoped-class/new shared-marker identity. Medians: **Image 76.169→74.517 µs/App**, **Picture 82.538→80.661**, **Both 153.423→148.783**. These are complete App renders, not per-image or browser timings. Original scoped-CSS results remain under `original-css`.

The first actual client period builds seven alternating pairs per Image/Picture/Both fixture, with ordinary photo imports and all JS/CSS counted. Image SHA/byte multisets must match. Strict SSR hydration, one selected image request and useful no-JS markup pass in `client-validation.json`. Image **18551→18549**, Picture **20314→20323**, Both **20691→20650 total gzip bytes**. Preserve Picture's nine-byte regression. The original scoped-CSS period remains separately archived. The final 3.1.8 pipeline/release fingerprint period remains under `final`, with Image **18551→18548**, Picture **20314→20319**, Both **20691→20653** total gzip bytes across seven pairs each. Its six strict hydration/no-JS fixtures also pass. The small difference from the first period is retained; no old rows are replaced.

Root-import headless-only builds emit **zero CSS** and **1764 JS gzip bytes** on both versions. No helper disappears behind a lazy or server chunk in these totals.

## Isolated sizes and rejected alternatives

Independent same-workspace measurements externalize Svelte and count all Imageway helpers:

| Entry   | Baseline JS | Selected JS | Baseline CSS | Selected CSS | Total before→after |
| ------- | ----------: | ----------: | -----------: | -----------: | -----------------: |
| Image   |        2953 |        2983 |          220 |          206 |          3173→3189 |
| Picture |        3096 |        3131 |          218 |          206 |          3314→3337 |

All numbers are gzip bytes. **Isolated JS grows, and the 2000-byte goal remains unmet.** The earlier prose total of 3335 for Picture was an arithmetic transcription error; the unchanged raw diagnostic already records 3314. Extracted archive/path identity gives different paired baselines of 2965/3110 JS and 218/215 CSS; do not mix them with same-workspace gates. Existing 3000/3150 JS and 3250/3400 JS+CSS regression budgets remain enforced. The budget script now sums gzip per emitted JS file, preventing artificial cross-chunk compression savings; both current isolated entries contain one JS chunk, so their numbers are unchanged.

A standalone filtering helper, tuple return, Object.assign return and alternate sizes loops were rejected after growing code or losing the sampled speed benefit. Exact snapshots/patches and diagnostic measurements remain under `rejected` and `diagnostics.json`. A later explicit-preload/unkeyed-each trial grows Image JS **2983→2996** while leaving Picture unchanged at 3131; both syntax edits were rejected. No timing or client-page claim is made for that rejected trial.

The null-prototype sizes lookup fixes inherited `constructor`, `toString` and `__proto__` names without changing supported breakpoints. Component metadata leaves valid headless options; exact style ordering and user-style precedence remain. [ADR 28](../docs/adr/0028-component-owned-metadata-and-styles.md) documents shared CSS, declaration cleanup and native prop/snippet/source behavior. No public API migration, consumer env declaration or browser WASM is added.

## Reproduce

Use Bun with pinned dependencies. Build, then verify/extract the archive with `bun bench/component-props/prepare.ts`. Run `attributes.ts`, `ssr.ts`, `client.ts` and `verify-client.ts` serially with `--output-dir=<fresh-directory>` to preserve earlier data. Fixture sources, compiler/runtime versions, controls and source fingerprints are versioned. Headless/SSR controls must compare complete canonical output, and client checks must include every emitted JS/CSS file plus SSR hydration/no-JS behavior. `profile-build.ts` has a fixed diagnostic output path; preserve its old outputs before rerunning.

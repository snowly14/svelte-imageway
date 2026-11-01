# ADR 34: Load the XML parser on the first SVG

Status: selected locally, unpublished. Date: 1 November 2026.

The synchronous signature/validation API previously imported the Saxes XML parser eagerly, including in photographic build workers. Saxes 6.0.0 exposes a CommonJS main entry. A module-local Node createRequire loads its constructor only when SVG validation reaches the parser, preserving the existing synchronous API and all geometry-only validation. Each validation creates a fresh parser. Missing or broken parser dependencies still fail; no unvalidated SVG is accepted. This Node-only path remains outside browser entry points and does not change Rust build steps.

Seven alternating/rotated full-build rounds compare a frozen snapshot of the immediately preceding local implementation with the candidate. Both snapshots already include the preceding Rust CRC and cache fixes; this is not a direct comparison to published 3.1.9. Inputs, codec settings, integer widths and output byte/SHA multisets match. Raw samples and machine notes are in `bench/results/lazy-svg-2026-11-01/`.

Photo cold/warm medians are 353.02/60.31→344.96/58.79 ms; cold RSS 270.80→268.91 MiB. Synthetic cold/warm are 98.37/37.32→94.78/35.52 ms; cold RSS regresses 268.58→268.92 MiB. Ranges overlap; no universal speedup is established. Both competitors remain ahead: photo cold imagetools/enhanced-img 316.21/318.98 ms, synthetic 67.28/68.69 ms. Worker concurrency and admission remain unchanged.

The deferred work is explicitly measured: seven alternating fresh-process imports and first SVG validations give import medians 2.434→1.040 ms and first-validation medians 0.631→1.730 ms. The median combined import-plus-first-validation is 3.065→2.725 ms; these combined medians are calculated per pair, not by adding separate medians. Warm single-small-SVG validation medians are 6.243→6.158 µs. This is validator startup, not a complete SVG encode/build study. The first SVG now pays the module load. A fresh-process regression test proves Saxes is absent after importing the pipeline and inspecting PNG, present after validating SVG, and active SVG still rejected.

The processing fingerprint invalidates conservatively. No public API, codec, format-pruning policy, emitted image bytes or memory/admission limit changes. Standard lint, typecheck, Svelte and 331 tests pass locally. Package/browser/consumer verification and exact-source CI must include the final selected source before publication.

# Provider ladder maximum — 1 November 2026

The responsive provider width ladder is deduplicated, sorted numerically and includes a fallback width. For valid finite dimensions it is nonempty, so the last width is the maximum. Use that value directly for per-format width limits instead of rescanning/spreading the ladder with Math.max. Provider requests, ordering and public API stay the same. Boundary tests cover below/at/above the AVIF limit, unsorted duplicate input widths and input ownership.

Same-path isolated builds before/after report Image 2957→2951 and Picture 3103→3097 JS gzip bytes, with Svelte externalized and 206 CSS gzip bytes each. This does not achieve the 2000-byte target. Raw JS shrinks six bytes per entry; no broad runtime CPU claim is made.

Seven alternating actual client builds per Image/Picture/Both fixture include Svelte and all emitted JS/CSS gzip files. Totals are Image 18533→18525, Picture 20302→20296, Both 20637→20629 bytes. The baseline is a copy of the current compiled package with only props.js restored to its preceding implementation. Its processing revision, Rust artifact and SVG loading path match the candidate. These totals must not be compared directly with older periods whose image URL fingerprints differ. Every image asset-byte/SHA multiset matches, and all six strict hydration/no-JS fixtures pass. The protocol and raw pairs are in `results/client-width-last-2026-11-01/`.

The client harness now accepts an explicit --baseline package and records both compiled props SHA-256 values. Prior results remain unchanged. No stripped component, new public option, dynamic client chunk or browser WASM is introduced.

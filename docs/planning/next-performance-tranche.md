# Next performance tranche

The current tranche is bounded BlurHash display decoding (3.1.3). Read REPORT.md and its release receipt for actual delivery status. The under-2000-byte component and default build/RSS leadership targets remain open.

1. Profile source decode/metadata repetition across the three responsive widths and preview. Measure cold startup of 1/2/4 workers on both corpora before modifying defaults. Sharp/libvips already provides native C++ codecs; preserve byte/quality, dimension limits and hard worker deadlines. Report throughput and RSS together, including regressions.
2. Prototype bounded build-only batching/reuse of prepared sources if profiles show repeated decode dominates. Keep runtime admission and termination separate. Do not switch to an unbounded main-thread transform path to win a cold benchmark. Evaluate Rust orchestration only against an optimized JS control with FFI/copies included.
3. Investigate full Image/Picture client costs while preserving provider/context/native attrs/snippets/preload/SSR/no-JS/reduced motion. All reachable JS, CSS and lazy chunks must count. Do not resurrect StaticImage under another name or ship browser WASM simply to hide JS size. A breaking API needs a concrete migration and measured benefit.
4. Further preview work (projection/packing fusion) is secondary to those default-path gaps. Node hashing already uses native crypto; do not replace it with a Rust/WASM copy path without a demonstrated end-to-end win.

Resume from REPORT.md, the latest release receipt and the dated raw benchmark evidence. Use Bun for installation/scripts and run heavy benchmark suites serially. Preserve the deferred documentation website. This document defines future work; it does not claim that those improvements have been implemented or verified.

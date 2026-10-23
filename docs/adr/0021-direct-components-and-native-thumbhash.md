# Direct component rendering and bounded native ThumbHash

## Context

The 3.1 release improved preview colour and warm builds, but Image/Picture remained above the 1536-byte stretch target. A private ImageElement component added reactive prop forwarding, a wrapper snippet and conditional rendering to both entries. ThumbHash still performed LPQA conversion and DCT projection in JavaScript after native colour extraction.

## Decision

Image and Picture render their own img elements, loading/error snippets and lifecycle handlers directly. Picture keeps source elements inside picture and fallback snippets outside it. Each component owns its existing load/failure/fade state and scoped CSS. This deliberately duplicates a small lifecycle block across two components to eliminate a runtime abstraction. Browser regressions exercise both components together, including loading, failure, callback `this`, source replacement and recovery. Report JavaScript and CSS separately, including a page that uses both components, to expose style duplication instead of hiding it behind a JS-only budget.

A browser reproduction exposed an existing specificity bug: the active fade selector overrode the less-specific reduced-motion rule. The media rule now matches the animated selector as well. Both components must report `animation-name: none` under reduced motion, including an active reveal class; checking only transition duration did not cover this case. The corrected stylesheet is included in final size measurements.

The existing precompiled Rust module adds ThumbHash LPQA conversion, bounded DCT and byte packing. The host supplies cosine tables calculated with the reference JS arithmetic order and caches them for the last dimensions. Rust reuses one 1024-element f64 channel scratch plane and at most 28 coefficients. Input is capped at 32×32 RGBA; the owned output is at most 25 bytes. Both host and native validate dimensions before reads/writes. Synchronous calls serialize access to the shared fixed scratch storage. Caller pixel buffers and returned hashes cannot alias module memory.

The module remains one fixed, non-growable 64 KiB memory with no host imports, allocator or consumer Rust toolchain. Decoding the ThumbHash into its PNG data URL remains in the existing JS package on the server/build side. Sharp/libvips still performs real image decoding, resizing and encoding. No WASM enters a browser entry. Package fingerprints, an independent Linux byte-identical Rust rebuild, owned-output tests, alpha/solid/seeded reference parity and full photographic preview digest checks remain gates.

The bundled module is required for previews; missing or incompatible artifacts fail processing, as in 3.1. `none` does not load it. Ambiguous dominant-colour maxima still use Sharp statistics. No silent encoder substitution or quality-setting change is introduced. The reference algorithm's MIT notice is included in `native/blurhash/NOTICE` and the shipped `dist/node/BLURHASH-NOTICE` (legacy filename).

## Measurement and limits

Compare against the SHA-256-pinned npm 3.1.0 archive. Seven alternating fresh-process sets measure the published reference JS encoder, a cosine-cached bounded JS control, and the actual Rust host/kernel method with validation/copy/owned-output overhead. The JS control uses the same scratch reuse and arithmetic but needs no FFI input copy. This distinguishes algorithm changes from language effects. Measure complete ThumbHash previews and unchanged LQIP as a control, with byte-identical complete output. Initialization and first batches remain separate from steady-state kernels. Client fixtures include SSR and strict hydration.

Results, machine notes and limitations belong in `bench/PATCH-3.1.1.md` and its raw data. A faster preview kernel does not establish faster codec encoding, HTTP delivery, or full-build leadership. The complete component remains above 1.5 KiB; both isolated and real-page JS/CSS are reported.

Reference: [ThumbHash format and reference implementations](https://evanw.github.io/thumbhash/), [MIT source](https://github.com/evanw/thumbhash), JS package `thumbhash@0.1.1`.

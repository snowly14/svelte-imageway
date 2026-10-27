# Avoid unused preview clones and reduce component attribute code

## Decision

A Vite build requests encoded variants with `includePreview = false`; previews are generated and cached separately. Create the Sharp preview clone only when the caller actually requests a preview. Keep the same input signature checks, frame and pixel limits, Sharp transform options, codecs, quality, timeouts, output-size checks and encoded payload. Preview-enabled runtime transforms still clone before selecting the encoder and produce the same color and preview bytes. No public option, native ABI or worker lifecycle changes.

Compact the responsive-size lookup into four explicit comparisons; only known breakpoints are accepted, including when tokens contain inherited property names. A slash-prefixed string cannot match the protocol expression, so the provider source classification does not need a separate slash test. Equivalent comparisons select named placeholder modes without constructing a temporary array. These changes preserve the exact attributes, URL ordering, user style precedence and source classification for the tested inputs.

Only query Resource Timing for an image load when the image has not already been marked loaded. A repeated cached load still updates state and calls the user's listener with the image element as `this`. The loading, error, SSR, no-JS, priority preload and reduced-motion behavior remains. The browser test repeats a cached load with Resource Timing unavailable and checks both components' callbacks.

## Evidence and tradeoffs

See [the benchmark study](../../bench/PERF-3.1.9.md) for frozen 3.1.8 inputs, output byte identity, memory, time, full-page JS/CSS and every recorded regression. The clone avoidance has a measured memory benefit in the sequential no-preview transform experiment. Timings and default multi-format builds do not establish a broad speedup; the first default cold median regresses. Isolated Image/Picture code is smaller but remains above the requested 2000-byte goal. Two larger component rewrites were rejected and their source/results retained.

Sharp/libvips already implements the image codecs natively. An additional Rust/FFI wrapper is not supported by evidence for these small JS control-path changes. The existing precompiled fixed-memory Rust preview kernel, independent rebuild and consumer toolchain requirements are unchanged. Do not change codec quality or skip validation to manufacture a benchmark win.

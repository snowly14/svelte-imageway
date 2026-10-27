---
'svelte-imageway': patch
---

Avoid creating an unused Sharp preview clone for transforms that do not request previews. Compact responsive-size and placeholder selection, and avoid an unnecessary Resource Timing lookup for already-loaded images. Preserve exact encoded bytes, image quality, public props, SSR, callbacks and resource limits; document the benchmark results and remaining regressions.

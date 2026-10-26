# 0025 — Lazy client registry and provider lookup

Date: 2026-10-26

Status: Accepted after local compatibility and measurement gates; exact-source CI remains required before publication.

The component-size investigation finds that the exported headless attributes entry already costs 2058 gzip bytes with Svelte externalized. The full entries add lifecycle, preload, snippets and native attributes. Removing behavior or moving code into uncounted chunks would not satisfy the requested complete-entry budget.

Reading an unregistered URL previously called the HMR registry initializer, creating both maps even when the application had no image registrations. Resolution now reads the existing global symbol without creating storage. Registration alone still creates the shared maps, preserving HMR identity replacement and multiple imports sharing one original URL. The registry key and public API stay stable.

When no provider map exists, provider selection now returns the configured fallback directly. Hostname parsing cannot influence that result, so parsing an absolute URL or throwing/catching for a local key is unnecessary. Generated public config omits an empty provider map, enabling this path for default components. A configured map, including an explicitly supplied empty map, retains hostname/wildcard/own-property selection. Provider validation, URL generation and all signature/width/format contracts stay unchanged. Already registered artifacts still bypass providers entirely.

Native artifact representation selection is inlined in the attributes helper; the existing public imageRepresentation export remains available and unchanged. The redundant second artifact test is removed only after provider assignment has already excluded artifacts. Returned attributes and image bytes remain identical; no API change or migration is required.

A bit-packed lifecycle prototype made the complete entries larger by 13/10 gzip bytes; a direct-truthiness variation only saved 6/2 bytes alongside the lazy-registry experiment. Both are rejected in favor of readable independent states. No component lifecycle, reduced-motion, snippets, callback binding or no-JS behavior is changed.

Seven alternating fresh-process rounds measure complete getImageProps work, not just URL construction, with unchanged registered/mapped/empty-map controls. Complete canonical output JSON must match the pinned npm 3.1.4 baseline. Separate client/SSR builds count all JS, CSS and chunks including Svelte. The actual Image page grows eight total gzip bytes despite the smaller isolated entry; retain that regression and the two extra CSS bytes in the Both fixture. The under2000-byte goal remains unmet. See the dated benchmark report and REPORT.md.

This is a browser allocation/control-flow problem. Adding server-side Rust would not remove its browser cost; adding browser WASM would introduce a new download/initialization boundary without measured benefit. The existing fixed-memory precompiled Rust preview module and contributor verification steps remain unchanged. There is no new Rust/codec/build/HTTP performance claim.

# svelte-imageway

## 1.4.0

### Minor Changes

- Add typed immutable prepared image sources and reuse them in the HTTP service, eliminating repeated source copies and content hashing on cache hits while retaining source expiry and authorization. Finite Vite builds use up to four workers based on available parallelism; the existing concurrency override remains available for memory-constrained builds. Add alternating, byte-verified HTTP comparison benchmarks.

## 1.3.1

- Schedule finite Vite build batches outside runtime request admission, starting each worker deadline only when a bounded build slot is available. This prevents legitimate large variant batches from consuming the request queue's byte/deadline budget. Runtime request limits and individual transformation deadlines are unchanged.

## 1.3.0

- Add StaticImage and the svelte-imageway/static entry for artifact-only delivery, measured separately from the complete Image component.
- Omit default AVIF sources only when all matching WebP sizes are no larger. Preserve explicit format directives and fallback formats; opt out with pruneLargerFormats: false. This is byte selection, not a perceptual quality comparison.
- Transfer exclusively owned worker output allocations and avoid redundant signature/output copies. Keep fallback copies for pooled/partial buffers.
- Canonicalize Vite source/root paths before containment checks, preserving rejection of external sources across Windows aliases.
- Deduplicate actual srcset widths when fixed-height resizing collapses several requested sizes.
- Apply configured byte/pixel/timeout limits to previews and the output byte limit to optimized SVG imports.
- Add alternating baseline/current benchmarks with byte-identical output checks. Make the optional Worker runtime benchmark explicit instead of requiring an undeclared local server.
- Enforce a separate 1536-byte StaticImage budget. The complete Image budget and original unmet performance targets remain distinct.

## 1.2.0

- Prefer server format negotiation for dynamic local/Edge providers; retain explicit picture mode and format allowlists.
- Render a native img without an unnecessary picture wrapper when no sources are needed.
- Avoid nearly identical final default build widths; preserve explicit width directives.
- Generate the baseline type reference consistently and add a standalone typegen CLI command for checks before Vite startup.
- Fix undefined format requests for providers that negotiate formats.
- Publish the reviewed release under latest. Original bundle/build performance stretch targets remain unmet; this release makes no fastest-on-the-market claim.

## 0.1.0

Initial preview published under the `next` dist-tag.

- Responsive Svelte 5 components and typed Vite image imports with persistent caches.
- Shared URL contract, signatures, provider/CMS builders and policy-enforced Node/Bun/Worker services.
- Build publication targets, deployment templates and init/optimize/audit/purge/migrate CLI.
- Strict source/SVG/resource policies, compiled-worker tests and local service/browser verification.

Known acceptance gaps: base Image size, build parity, exact Lighthouse 100 and additional codec/cloud coverage. See the repository report. This preview makes no 1.0 or included-CDN claim.

### Preview hardening before first publication

- Retain Worker transform admission until native encoding settles after a response timeout.
- Include decoder and output policy in Node representation cache identities.
- Apply responsive background variants through the CSS cascade.
- Reject empty memory-cache entries and cap entry count.
- Share disk-cache accounting across processors, serialize writes and amortize directory reconciliation with bounded filesystem concurrency.

- Normalize Windows file URLs and nested source keys, reject cross-drive path escapes, and keep LF checkout consistent across CI runners.
- Preserve transparent backgrounds in the native Worker binding.
- Count only response body bytes for HTTP metrics and reuse the output digest.

# svelte-imageway

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

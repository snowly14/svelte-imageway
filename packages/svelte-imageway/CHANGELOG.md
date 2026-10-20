# svelte-imageway

## 0.1.0

Initial local preview, prepared for the `next` dist-tag; not published yet.

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

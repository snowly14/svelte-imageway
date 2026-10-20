# Public preview preparation — 2026-10-20

The first public 0.1.0 preview includes fixes for five locally reproduced audit findings: native Worker admission after timeout, cache identities under stricter Node policies, responsive background cascade, empty/tiny memory entries and repeated full-directory disk-cache scans. See ADR 0013 for implementation and cache-sharing limits.

Executed locally under Node 24.22.0 with Bun 1.4.3:

- Lint, TypeScript, build and Svelte diagnostics: passed.
- Vitest: 212 passing tests, including the new cache and timeout regressions.
- Core coverage: 99.56% lines, 99.11% branches, 100% functions. This is core coverage, not whole-package coverage.
- Chromium and WebKit component E2E: eight passed. Four optional Worker/Docker HTTP tests skipped because those services were not running during this check.
- publint, ATTW ESM-only profile, packed-file allowlist and npm dry-run inspection: passed.
- Formatting: passed. Preview gzip budget: passed at 3,057 bytes; the original 1,536-byte acceptance remains unmet.
- Bun dependency audit: no known advisories reported.

Disk-cache microbenchmark (ten writes per size, Node 24.22.0): at 100/1,000/5,000 existing files, median set time changed from approximately 6.01/27.07/114.24 ms to 0.58/0.71/0.32 ms. The corrected measurement includes initial indexing as the first sample; the median reflects amortized writes. Results are local measurements, not production latency guarantees.

Public repository: https://github.com/snowly14/svelte-imageway. Private vulnerability reporting is enabled. npm publication requires the maintainer's npm authentication; GitHub publication alone does not install a registry package. The prior report's unverified cloud deployment and 1.0 acceptance gaps remain open.

## Extended follow-up

The clean-checkout gate now builds before checking generated types. Windows test execution exposed URL-to-path conversion and diagnostic separator issues; the compiled CLI and Vite boundary now use native paths internally and slash-separated public keys. Local path containment also rejects cross-drive absolute relative paths. Git attributes enforce LF checkout to keep formatting and generated pipeline identity consistent across OSes.

A fresh three-run build comparison after cache fixes measured medians of 274.52 ms cold / 49.50 ms warm for Imageway, 144.19 / 39.15 ms for vite-imagetools and 139.45 / 39.94 ms for enhanced-img. This remains slower than the comparators on this fixture set. A separate cold-build concurrency sweep measured approximately 446/283/221 ms with one/two/four workers. Explicit `imageway({ concurrency: 4 })` improves this small-image build scenario; the default remains two to retain conservative decoder admission. These results do not demonstrate market leadership or equal perceptual quality.

Additional regressions cover transparent native Worker backgrounds and HTTP byte metrics excluding HEAD/304 responses. The handler hashes output only once for both ETag and filename.

The comparison generated 18 images for each tool. Total bytes were 498,652 for Imageway and 745,147 for each comparator (about 33% less). Encoder defaults differ (including JPEG optimization), so this is a byte comparison, not a proof of equal visual quality. Final local regression count after the extended follow-up: 215 passing tests.

# ADR: ESM packaging and preview acceptance gates

Status: accepted for 0.1.0 preview, 20 October 2026.

The package is ESM-only, Svelte 5 and Kit 3. ATTW uses its explicit esm-only profile: legacy Node10 resolution and CommonJS require are unsupported; internal resolution errors remain enabled. Inferred provider declarations previously reached the main Svelte entry. Public SerializableProvider return annotations keep those server/browser-safe subpaths independent.

svelte-package emits .svelte.d.ts for bundler consumers. TypeScript NodeNext resolves arbitrary extensions as .d.svelte.ts. The package finalize step retains the original declarations and adds those aliases; ATTW verifies all exports without hiding internal errors. The CLI bin is executable and compiled worker files ship in the archive.

The requested 1,536-byte gzip limit currently fails at 3,057 bytes with every reachable Imageway helper included and only the Svelte peer externalized. A preview regression ceiling of 3,400 bytes makes CI reject growth while the original strict check stays visibly failing. This is a preview policy, not satisfaction of the 1.0 size target. The release workflow permits only reviewed 0.x versions. Other measured 1.0 gaps are recorded in REPORT.md.

Bun manages dependencies, scripts and pack creation. Bun's documented publisher cannot generate provenance. The final registry upload therefore uses npm publish with --provenance in a configured trusted-publisher CI environment, as required by the brief. No registry upload has been performed. Unknown repository/funding identities are omitted and an executable metadata check blocks release until real values are configured.

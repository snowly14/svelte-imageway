# Contributing

Use Bun 1.4.3 and an LTS Node runtime (CI: 22.23.3 and 24.22.0). Do not commit generated dist, local caches, credentials or personal browser profiles.

```sh
bun install
bun run check
bun run format:check
bun run package:check
bun run check:budget
```

`bun run build:components && bun run test:e2e` requires installed Playwright browsers. Service tests additionally require local Wrangler bindings and Docker fixtures. Benchmarks have a separate protocol in bench/README.md; keep raw measurements and disclose misses.

Use Conventional Commits. Husky runs formatting on staged files and commitlint on commit messages; install hooks with `bun run prepare`. Add a Changeset (`bun run changeset`) for a user-visible package change. Comments/public API docs are English. Svelte 5 runes/snippets only.

Reproduce a bug first, add a meaningful behavioral regression when appropriate, and run the relevant gate. Keep browser/server boundaries and admission limits intact. Document API/runtime tradeoffs in an ADR. No telemetry, billed deployment or source-media deletion by default.

The website in extras/ is deferred and excluded from active work. README and package changes take priority. See RELEASE.md for release identity, provenance and preview acceptance limits.

The preview kernel ships precompiled; ordinary installs require no Rust toolchain. Contributors changing `native/blurhash/lib.rs` need Rust 1.99.0 with the `wasm32-unknown-unknown` target. Run `bun run native:rebuild` to update the artifact and fingerprint manifest, then `bun run native:verify` for an independent byte-identical rebuild. Normal `bun run build` verifies fingerprints without invoking Rust. CI independently rebuilds on Linux. Preserve fixed 64 KiB memory and host/native dimension checks; add compatibility tests and an ADR for each new native surface. See [ADR 20](docs/adr/0020-native-preview-colour-and-lazy-build-tools.md) for histogram behavior and Sharp fallback, and [ADR 21](docs/adr/0021-direct-components-and-native-thumbhash.md) for ThumbHash arithmetic/ownership and component lifecycle constraints. Keep third-party algorithm notices in the shipped preview notice.

[ADR 22](docs/adr/0022-native-thumbhash-display-previews.md) covers native ThumbHash decoding, fixed-size PNG assembly and checksum bounds. Contributor build commands and the fixed-memory ABI checks remain the same. Keep the pinned JS reference in development dependencies for byte parity. `bun run check:2000` checks the requested complete-entry JS stretch target (Svelte externalized); it intentionally fails until both entries are below 2000 gzip bytes. Regression budgets and CSS totals are separate gates.

[ADR 23](docs/adr/0023-bounded-blurhash-display-decoding.md) covers the fixed 4x3 BlurHash display decoder, lazy gamma tables and exact rounding-boundary fallback. The same Rust 1.99.0 rebuild commands apply; independent compilation now treats Rust warnings as errors. Preserve the pinned JS development reference and differential/boundary tests when changing any numeric path.

[ADR 24](docs/adr/0024-private-shared-build-inputs.md) documents private shared backing stores for finite-build prepared sources. This uses Node worker/memory primitives and adds no native build step. Never expose or mutate a prepared backing store; retain runtime source isolation, logical queue byte limits and worker termination deadlines. The dated [worker benchmark](bench/BUILD-WORKERS-3.1.4.md) includes explicit child-cwd cache isolation and all original/regressed results.

[ADR 25](docs/adr/0025-lazy-client-lookups.md) covers lazy client registry/provider reads. It adds no native build steps. Keep first-read allocation checks in a fresh realm, exact provider/attribute contracts and complete per-file JS+CSS measurements. The [client study](bench/CLIENT-LOOKUP-3.1.5.md) retains the actual Image-page regression; Node timings are not browser-rendering claims.

[ADR 26](docs/adr/0026-unreserved-canonical-query.md) documents exact canonical-query optimization and its measured memory/size costs. It adds no native build steps. Preserve URIError on malformed UTF16, negative-character checks for trailing newlines, UTF16 key order, getter coercion and signature omission. Keep independent controls and every original benchmark period.

[ADR 27](docs/adr/0027-bounded-column-projection.md) covers bounded linear-RGB column reuse and exact coefficient-bit tests. No native ABI or build command changes; the 96-double scratch fits inside the existing fixed stack. Keep optimized JS ablations when measuring Rust gains and count host copies/owned strings. See the [3.1.7 study](bench/COLUMN-PROJECTION-3.1.7.md) for reproduction and retained failed alternatives.

[ADR 28](docs/adr/0028-component-owned-metadata-and-styles.md) covers component-only props and namespaced shared CSS. Count standalone and combined JS/CSS; ensure headless imports emit no CSS and both declaration-resolution modes pass without consumer type files.

[ADR 29](docs/adr/0029-bounded-sparse-colour-and-row-checksums.md) covers the bounded sparse histogram and row-deferred Adler checksum. The same Rust 1.99.0 commands apply: `rustup target add wasm32-unknown-unknown`, `bun run native:rebuild`, then `bun run native:verify`. No new native surface or ABI is added. Preserve all quantization thresholds, ties/reset interleavings, white-PNG carry cases, fixed memory and independent JS references. Always include optimized JS controls, FFI/copies and complete Sharp-preview costs.

[ADR 30](docs/adr/0030-private-vite-native-executor.md) covers the Vite-only shared native executor. It adds no Rust or consumer build step. Package the compiled `build-worker.js`; retain fault/deadline tests, real-worker termination/recovery, runtime isolation and byte-identical build gates. Record logical transform concurrency separately from physical worker count in benchmarks. Default multi-format imports and explicit WebP comparisons are separate studies; never discard a regressing period.

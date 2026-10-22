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

The preview kernel ships precompiled; ordinary installs require no Rust toolchain. Contributors changing `native/blurhash/lib.rs` need Rust 1.99.0 with the `wasm32-unknown-unknown` target. Run `bun run native:rebuild` to update the artifact and fingerprint manifest, then `bun run native:verify` for an independent byte-identical rebuild. Normal `bun run build` verifies fingerprints without invoking Rust. CI independently rebuilds on Linux. Preserve fixed 64 KiB memory and host/native dimension checks; add compatibility tests and an ADR for each new native surface. See [ADR 20](docs/adr/0020-native-preview-colour-and-lazy-build-tools.md) for histogram behavior and Sharp fallback.

# ADR 0001: One image model with separate execution boundaries

- Date: 2026-10-19
- Status: Proposed; implementation awaits M1 approval
- Scope: Svelte 5, current SvelteKit 3, Vite 8, managed providers, self-hosting, build publication

## Context

Local build optimization, remote CMS images and deployment-specific optimizers currently require different configuration and artifact shapes. A component should not need rewriting when an operator changes delivery infrastructure. The implementation must be honest about different backend capabilities, costs and runtime constraints.

The user explicitly selected Bun. This supersedes the original brief's pnpm monorepo requirement. The brief also requires approval between milestones and a plan before implementation.

## Decision

Use a Bun workspace with one public ESM/Svelte package and a private deployment workspace. All processing, delivery and publication paths share a versioned normalized image request and a serializable responsive artifact model. A provider may translate the request into a vendor-specific URL; the vendor's URL syntax need not be the v1 wire syntax. The Edge service itself accepts v1.

Planned layout (not yet generated):

```text
packages/svelte-imageway/    public package, src/lib subpath entry points
packages/edge/              private Worker and Node service entry points
apps/docs/                  SvelteKit 3 documentation and playground
examples/basic/             first-image and hydration verification
examples/static/            prerender/build publication
examples/node/              runtime Sharp route
examples/cloudflare/        Worker integration
examples/cms/               remote allowlisted sources
bench/                     fixture-driven reproducible comparisons
docs/                      ADRs, research, contract, release evidence
```

The public package exposes `.`, `./vite`, `./kit`, `./providers/*`, `./edge`, `./publish`, `./cli`, `./types`. Svelte compilation/declarations use `svelte-package`; worker/service entries must remain valid for their target runtime and be inspected in the packed artifact. Browser exports cannot re-export server barrels.

## Boundaries

1. **Portable core:** pure normalization, directive parsing, srcset/sizes, provider contracts, public configuration, format negotiation. No Node imports, secrets, filesystem or Sharp.
2. **Browser/Svelte:** runes, snippets, SSR-safe rendering, native loading, dimensions and preload. Import only portable code. No runtime dependencies for basic rendering; measure generated bundle rather than source length.
3. **Node tools/runtime:** lazy optional Sharp import, workers, filesystem cache, secure source acquisition and upload targets. Signing keys resolve only from server environment. A missing Sharp installation yields an actionable error only when a local transformation is requested.
4. **Worker edge:** Web APIs plus supported platform bindings. Never bundle a Node Sharp binary. Prefer restricted storage keys and Images binding or `cf.image`; do not silently fall back to a WASM encoder with unbounded CPU.
5. **Publication:** transforms emit content-addressed artifacts, upload through `StorageTarget`, then rewrite only package-generated URLs. A validated `publicBase` must point to the uploaded artifacts. No automatic global `paths.assets` mutation.

Public and private configuration are separate values. A Vite virtual module may serialize only an explicit allowlist of public fields; it must not spread the user's config, functions, environment objects or secrets. Provider signing occurs server-side or at build time; client components never receive signing keys.

## Three delivery layers

- A: `ImageProvider` exposes pure `buildUrl`, capabilities and validation. Purge is optional and server-only. Vendor-specific server helpers live outside the portable provider entry if needed.
- B: the self-hosted service implements v1 and acts as an origin behind a real CDN. Node uses Sharp; Workers delegates to a supported binding or upstream service.
- C: publication uploads build variants incrementally with content hashes, resumes failures, writes a versioned manifest and supports dry-run. Garbage collection is a separate, conservative, explicitly approved action.

The generic provider can be approximately ten lines because shared validation and encoding are library helpers. Unsupported operations produce structured capability errors. A configurable documented degradation policy may drop optional operations; it cannot silently reinterpret cropping or reveal a private source.

## Defaults and performance

Local-only operation needs no mandatory config. Proposed widths are a bounded ladder, clamped to intrinsic size, with no upscaling. Baseline outputs are AVIF/WebP plus a compatible fallback; production encoders and limits decide availability. LQIP (<1KB target) is the initial placeholder because it displays without a browser decoder. Thumbhash/blurhash remain optional build/server strategies that may serialize a display-ready preview.

Priority forces eager/high/sync attributes and head preload; it must not preload every candidate format and trigger duplicate downloads. Picture art direction needs media/type-aware preload matching. Unknown remote dimensions require supplied dimensions or a declared ratio; the component cannot synchronously infer them without source metadata. The CLS=0 claim applies to controlled examples, not arbitrary host CSS or missing dimension data.

CSS provides a useful no-JavaScript placeholder. Minimal component state handles loaded/cached/error transitions, user callbacks and reduced motion. Shared configuration uses a typed Svelte context per subtree; never a mutable module-global request configuration during SSR.

## Security from the first service code

Remote fetches require explicit HTTPS origins, restricted ports and bounded redirects. Node validates all resolved A/AAAA addresses, blocks local/private/link-local/metadata/mapped encodings, and pins the validated connection address while preserving the approved hostname for Host/TLS. Revalidate every redirect. If a runtime cannot safely enforce DNS/connection policy, disable arbitrary remote fetching and require trusted storage keys or an independently secured upstream.

The threat assessment follows the [OWASP SSRF prevention guidance](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html); the specific runtime/transport controls still require adversarial execution tests.

Local sources use realpath containment inside approved roots, including symlink escapes. Enforce bytes, decoded pixels/pages, output bytes, timeouts, queue/concurrency limits and magic-byte checks. Reject active SVG or rasterize in a restricted pipeline; SVGO is not a sanitizer. Disable unsafe decoder settings. Strip sensitive metadata by default.

HMAC-SHA256 signing, key IDs, expiry, rotation, constant-time verification, locked presets and canonicalization are specified in ADR 0002. Authentication and expiration checks occur before cache reads. Public caching must not expose private images or outlive a private authorization contract.

## Cache and reliability

Build cache identity contains input bytes, normalized transformations, pipeline/codec version and relevant output policy. Write atomically and deduplicate jobs. Runtime cache adds source identity/revision and output MIME. Mutable sources require TTL/revalidation; signatures alone never justify immutable caching.

Memory LRU is bounded by bytes, disk by configured storage budget; in-flight maps are bounded. Concurrent deduplication is per process/isolate unless a shared backend is configured. Structured logging excludes client IPs and secret-bearing source query strings by default.

Fallback/circuit breaking belongs in the runtime transport, since a pure URL builder cannot observe HTTP 5xx or enforce a timeout. Browser error callbacks cannot reliably distinguish status codes. Server fallback stops on authorization/validation failures, preserves policy, applies deadlines and retries only eligible errors. Returning the original source is allowed only for public sources explicitly configured for fallback.

## Adapter strategy

`imageAdapter()` wraps a supplied current SvelteKit adapter, preserving its interface. Detect recognized adapters using documented metadata/capabilities where available; provide an explicit target override for auto/unknown adapters. Never rely on names of nonexistent packages or guess an edge runtime from a hostname.

| Target                | Proposed behavior                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------ |
| static                | Build variants and optional publication; no dynamic Sharp endpoint                                           |
| Node / verified Bun   | Sharp runtime with bounded memory/disk cache                                                                 |
| Vercel                | Emit supported platform image configuration; delegate to native image service                                |
| Netlify               | Use Image CDN and validated remote patterns                                                                  |
| Cloudflare            | Binding/transformation provider; no native Sharp                                                             |
| auto / unknown / Deno | Detect supported configuration or require an explicit target; actionable failure for impossible combinations |

Ordinary Link headers and head preload are portable targets. SvelteKit streaming cannot guarantee discovery before headers flush; track preload hints per request or declare them earlier. 103 Early Hints remain platform-dependent and require specific evidence. Do not promise to add them through a generic Fetch Response.

## Dependency decisions

| Dependency                                    | Purpose and justification                                                            | Placement                                          |
| --------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------- |
| Svelte                                        | Required component peer, ^5 baseline                                                 | Peer                                               |
| SvelteKit/Vite/Svelte plugin                  | Current integration contracts; examples and build tooling                            | Optional integration peers/dev                     |
| @sveltejs/package / TypeScript 6              | Supported package output and strict declarations; TS7 peer conflict documented       | Development                                        |
| Sharp                                         | Existing high-quality codec/pixel pipeline; no homegrown codecs                      | Optional server/build peer, dev fixture dependency |
| SVGO                                          | Optimizes approved SVG; cannot supply security guarantees                            | Server/build only, when introduced                 |
| thumbhash / blurhash                          | Optional placeholder algorithms if they meet no-JS and bundle requirements           | Server/build optional                              |
| Vitest / coverage / Playwright                | Unit/type/SSR/browser/security regression evidence                                   | Development; versions aligned                      |
| Wrangler / Worker types                       | Actual local Worker runtime and bindings                                             | Edge development only                              |
| AWS S3 SDK                                    | Signing, retries and interoperability justify a scoped SDK when S3 targets are built | Optional publish-only dependency in M7             |
| ESLint / Svelte plugin / Prettier             | Framework-aware lint and formatting                                                  | Development                                        |
| Changesets / commitlint / Husky / lint-staged | Release history, commit conventions and local changed-file checks                    | Development; CI remains authoritative              |
| OpenTelemetry API                             | Optional observability hooks without mandatory exporters                             | Optional server integration only                   |

Use native URL, Web Crypto, fetch, filesystem primitives and small explicit validation for the narrow contract. Generate machine schemas and check them against the validator; do not add a large runtime schema framework by default. If security requires a well-maintained IP parser or sanitization library, record its evidence and justification before addition. Do not implement a fragile ad-hoc IP regular expression.

## Alternatives rejected

- A bundled “global CDN”: not something an npm package can provide.
- Mandatory Sharp in portable/browser exports: breaks edge isolation and inflates installs.
- A wrapper around enhanced-img plus an unrelated proxy: easier initially but leaves two contracts/configuration systems.
- Full feature parity across every provider: false for formats, smart cropping, animation, purge and signing.
- Automatically adding a global hook to an arbitrary app: fragile and may break existing hooks; offer an explicit composable handle and narrowly scoped validated integration.
- WASM as the universal Worker default: CPU, memory, binary size and codec support need measurements.
- Automatic paid deployment/publication: credentials, bills and destructive operations need an explicit reviewed action.
- pnpm workspace: superseded by the user's Bun instruction.

## Consequences and gates

This is a substantial multi-milestone project. Phase 0 establishes a design, not runtime behavior. M1 must prove the pure/Node boundary and >90% core coverage; M2 proves actual Vite emitted assets/dev HMR; M3 proves SSR/hydration/bundle size; later gates prove each deployment path. Keep every claim's evidence in REPORT.md and stop after each milestone for the user's approval.

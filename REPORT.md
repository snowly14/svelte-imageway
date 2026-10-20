# Project report

## Current status

**M1 implemented and verified on 2026-10-20. The user authorized continuous execution of M1–M11; per-milestone approval is no longer required. No npm publication or cloud deployment has occurred.**

Selected name: `svelte-imageway` (public registry E404 at research time). Bun replaces pnpm by user instruction. Proposed baseline: Svelte 5.57.2, Kit 3.1.0, Vite 8.3.4, Node 24.22.0 LTS and TypeScript 6.0.3 (latest compatible, despite 7.0.2 being current stable).

Architecture: [ADR 0001](docs/adr/0001-architecture.md), [URL ADR](docs/adr/0002-url-contract.md), [draft contract](docs/spec/url-contract.md). Research: [competition](docs/research/competitive-analysis.md), [compatibility](docs/research/versions-and-compatibility.md), [platforms/costs](docs/research/platforms-and-costs.md), [names](docs/research/package-names.md). Work sequence: [eleven milestones](docs/planning/milestones.md).

## Phase 0 evidence

- [x] Read and preserve the original brief; inspect target directory/ancestor instructions.
- [x] Run `npm view` on required packages, competitors, official adapters and five candidate names; preserve raw structured responses and exit codes.
- [x] Check Node LTS against the official release index and policy; identify Current host runtime separately.
- [x] Review official framework/codec/provider documentation and dated pricing sources; explicitly record unresolved API/account/cache details.
- [x] Write the competitive analysis, proposed architecture, URL-contract design and milestone plan before any implementation source.
- [x] Initialize a local Git repository; no remote or npm identity invented.
- [x] Verify macOS sleep assertions under a project-specific launchd job; shutdown is pending genuine final completion.
- [x] Validate 11 authored Markdown files with markdownlint-cli2 0.23.3 (0 issues), 25 local document links, 2 evidence JSON files, 30 registry entries and byte-for-byte preservation of the original brief.
- [x] Pass staged whitespace validation; include this report in the Phase 0 Conventional Commit.
- [x] User approved all implementation milestones on 2026-10-20, retaining their order, validation and commits.

## Execution ledger

| Check | Status | Evidence / limitation |
| --- | --- | --- |
| Registry metadata and candidate names | Executed | docs/research/evidence/npm-view-2026-10-19.json |
| TypeScript 6.0.3 metadata | Executed | `npm view typescript@6.0.3 version engines --json`; exact selection and Node engine recorded |
| Node release index | Executed | Official index returned 24.22.0 LTS / 22.23.3 LTS / 26.12.0 Current |
| Host tools | Executed | Bun 1.4.3, Node 26.11.1, npm 11.20.0; Docker not found |
| Markdown / links / JSON / original brief | Passed | markdownlint-cli2 0.23.3: 11 authored files, 0 issues; Python: 25 local links, 2 valid JSON files, 30 registry entries, original brief unchanged |
| Git staged whitespace | Passed | `git diff --cached --check` returned exit 0 |
| Dependency installation | Not run | No implementation manifest before M1 approval |
| Lint / TypeScript / unit / coverage / component tests | Not run | No implementation yet; cannot claim green |
| Vite/Kit examples / browser E2E / Lighthouse | Not run | M2 onward |
| Wrangler / Miniflare / Docker Compose | Not run | Worker not built; Docker absent |
| Benchmarks / bundle size / npm pack / package checks | Not run | M10/M11 evidence required |
| Cloud deployment / paid activation / publication | Not attempted | No credentials used; future actions require the specified approvals |

## Requirements checklist

Unchecked means **not implemented or not proven**, even when a design exists. Planning status is not product completion. This checklist will be expanded with direct command/fixture evidence at each gate.

### Performance

- [ ] LCP priority attributes, matching head preload and HTTP Link; platform-specific 103 evidence.
- [ ] Explicit dimensions/aspect ratio and controlled-example CLS=0.
- [ ] No blocking client processing; INP behavior measured where relevant.
- [ ] AVIF/WebP/fallback output and perceptual-quality policy verified.
- [ ] Bounded responsive widths, srcset/density semantics and DPR deduplication.
- [ ] Save-Data/Client Hints quality and cache isolation.
- [ ] AVIF encoding/decoding tradeoffs measured; backend limits respected.
- [ ] Off-screen lazy images; sizes auto compatibility and fallback verified.
- [ ] GIF animation handling and optional video output verified.
- [ ] Base component <1.5KB gzip and zero unnecessary browser dependencies.

### Reliability

- [ ] 404, network errors, deadlines and broken-image snippets/callbacks.
- [ ] Eligible provider fallback and timeout/5xx circuit breaking.
- [ ] HEIC/HEIF, TIFF, BMP, ICO, JXL capability behavior and unsupported-codec errors.
- [ ] Very large images, decompression limits and corrupt input fixtures.
- [ ] EXIF orientation, GPS removal, ICC, CMYK and transparency fixtures.
- [ ] Animated fixtures with frame/pixel budgets and metadata fidelity.
- [ ] Worker concurrency, memory/disk bounds, anti-stampede and atomic writes.
- [ ] Cache warm-hit target >95% on a documented repeat workload.

### Security

- [ ] Mandatory remote-origin allowlist and safe HTTPS/port/userinfo parsing.
- [ ] Private/local/metadata/IPv4/IPv6/mapped/encoded address rejection.
- [ ] Redirect checks and DNS rebinding protection at the actual connection.
- [ ] Filesystem realpath containment, symlink/traversal protection.
- [ ] HMAC canonicalization, expiry, key rotation and constant-time verification.
- [ ] Signature/authorization checked before cache; private/shared-cache isolation.
- [ ] Locked presets, bounded transforms and rate/budget guards.
- [ ] Input/output bytes, pixels/pages, queue/concurrency and timeouts bounded.
- [ ] Magic-byte validation and active SVG handling; no assumption SVGO sanitizes.
- [ ] Server secrets and Node/Sharp code absent from browser bundles.
- [ ] Authenticated purge/metrics where appropriate; no destructive implicit actions.
- [ ] SECURITY.md threat model and automated adversarial regression tests.

### Developer experience

- [ ] Local zero-config imports and one-plugin integration.
- [ ] Typed artifact, required alt, public JSDoc, subpath exports and config schemas.
- [ ] Actionable codec/runtime/configuration errors.
- [ ] Image/Picture/BackgroundImage/ImageMeta, headless API and subtree context.
- [ ] Loading/error snippets and native attributes/events.
- [ ] CLI init/optimize/audit/deploy/purge/migrate, watch, dry-run, JSON/CI exits, NO_COLOR.
- [ ] Idempotent parser-aware enhanced-img/imagetools migration.
- [ ] Playground and optional developer overlay/preprocessor explicitly tracked.

### Ecosystem

- [ ] Official static/node/auto/vercel/netlify/cloudflare adapter integration.
- [ ] Bun/Deno runtime/adapter paths individually verified or clearly unsupported.
- [ ] SSR, streaming, prerender, SSG and SPA behavior.
- [ ] Vite development laziness, persistent cache, HMR and correct production assets.
- [ ] CMS helpers for Sanity, Contentful, Strapi, Directus, WordPress, Storyblok, Prismic, DatoCMS, Shopify and Unsplash.
- [ ] Additional provider capability/purge/signature/animation matrix.
- [ ] R2/S3/Bunny/B2/Blob/Supabase publication and static-CDN URL tests.
- [ ] mdsvex/Markdown, Storybook, Tailwind and monorepo guidance/examples.
- [ ] PWA/service-worker caching recipe.

### Accessibility and SEO

- [ ] Required alt and explicit decorative empty alt; i18n-compatible values.
- [ ] Reduced-motion transitions; useful no-JavaScript and cached-image behavior.
- [ ] No information communicated only by placeholder color.
- [ ] Open Graph/Twitter/image_src dimensions and actual MIME.
- [ ] Image sitemap utility or explicitly unmet optional requirement.
- [ ] Alt/dimensions/loading/format/weight/LCP audit diagnostics.

### Privacy and cost

- [ ] Metadata/GPS policy enforced by tests, not documentation alone.
- [ ] No telemetry by default; no client-IP or secret-source-query logging.
- [ ] RGPD operational guidance, storage/log retention and opt-in observability.
- [ ] Updated provider costs, free-tier limits and verified cache recipes.
- [ ] Distributed budget/rate limits and clearly stated enforcement scope.
- [ ] No included-CDN claim; separate origin/CDN/storage costs documented.

### Maintenance and publication

- [ ] MIT/governance/security/contributing/conduct/issue/PR templates complete.
- [ ] Changesets, changelog, semver/compatibility/deprecation policies.
- [ ] Node LTS × OS CI actually green, framework-aware lint and strict type checks.
- [ ] Core >90% coverage with meaningful security and cache tests.
- [ ] Packed consumer, tree-shaking, server leak, publint and arethetypeswrong checks.
- [ ] Restricted package files, complete real repository/bugs/homepage/funding metadata.
- [ ] Provenance release workflow and npm pack inspection.
- [ ] Exact publication commands resolved against actual owner/repository/package metadata.
- [ ] Initial 0.1.0 next release; 1.0.0 only after all required success criteria.

## Benchmarks and Definition of Done

No measurements exist. Installation <2 minutes, Lighthouse Performance 100 for the controlled example, CLS=0, correctly preloaded LCP, median weight reduction >=60%, build parity with imagetools, TTFB/throughput/RSS comparisons, provider switching without component edits and Worker deployment <10 minutes are open acceptance gates. No numerical performance claim is justified by the research.

Record the dataset/license, source/output bytes, dimensions/quality, failures, OS/CPU, tool/runtime versions, warm/cold protocol, sample counts and raw outputs when benchmarks are run. Native Cloudflare comparisons require real infrastructure and cannot be replaced by a local mocked timing.

## Known limits and risks

The framework ecosystem has moved to Kit 3/Vite 8/TypeScript 6-compatible tooling. This requires current APIs rather than legacy configuration examples. Some exotic codecs and animated AVIF cannot be promised based on Sharp's name alone. Worker offline binding support is a subset. Docker is not installed. No cloud account access, npm organization, GitHub remote, benchmark corpus or publish identity has been assumed. Additional-provider API parity and some exact cache/account cost details remain pending and must be resolved before their milestones are called complete.

## Roadmap and publication

M1–M11 are the roadmap to a verified 0.1.0 next release. 1.0.0 requires all mandatory success criteria and no falsely green checks. Optional v1.x candidates are advanced video encoding, broader experimental decoders, developer overlay, auto-preprocessor, extra presentation components, and additional provider-specific features. If an original mandatory requirement remains unmet, list it as a release blocker, not silently move it to bonuses.

There is no publishable artifact yet, so this phase supplies no pretend “exact publish command.” M11 must provide owner-specific commands after actual pack/type/runtime/provenance verification. No npm publication, remote push or paid deployment occurs in Phase 0.

## M1 — verified core (2026-10-20)

Bun workspace and isolated Node 24.22.0 runtime installed. Implemented strict v1 normalization, bounded widths/qualities/DPR, presets, HMAC key rotation/expiration, Accept q-values, JSON Schema/OpenAPI, IP classification, HTTPS connection pinning and redirect revalidation, source deadlines and local containment. Added lazy Sharp loading, signature sniffing, restricted SVG rasterization, orientation/ICC/privacy policies, frame/pixel/byte limits, bounded worker_threads, atomic disk cache, byte LRU and content/codec-addressed deduplicated processing.

`fnm exec --using 24.22.0 bun run check`: lint, strict types, svelte-package build and unit/security/pipeline tests passed. The suite exercises real JPEG/PNG/WebP/AVIF/TIFF/GIF, multi-frame animation, EXIF, CMYK+ICC, alpha, corrupt images, input/output limits, compiled workers and cache restart/invalidation. Warm repeated processing achieved 100% cache hits in the declared 100-request repeat test. A real connection-pinned HTTPS fetch from raw.githubusercontent.com returned 22,949 bytes. Coverage of the portable core exceeds 90% (latest exact counts are in the validation log).

Codec limits remain explicit: this baseline rejects unsupported exotic containers/encoders instead of silently mis-decoding or flattening animation. Exotic decoder extensions and additional real-world fixture coverage remain tracked for later validation; no all-codec support claim is made. Runtime source roots must be controlled by the application operator; arbitrary concurrent filesystem writers are outside the configured-root trust boundary.

## M2 — verified Vite plugin (2026-10-20)

Implemented typed responsive imports, exact import widths/quality, multiple formats, content-hashed emitted assets, alpha-aware fallback, animation-preserving output selection, approved SVG optimization, server-generated LQIP/color/thumbhash/blurhash, persistent cache, bounded parallel worker jobs, lazy dev URLs and file-watch invalidation. Real Vite build and HTTP dev tests verify correct bytes/dimensions, zero variants at startup/module import, lazy processing, 405 for invalid image methods, content identity after a file change and absence of Node/Sharp in generated browser code.

TypeScript allows only one wildcard per ambient module name. Arbitrary directive suffixes therefore get specific generated declarations in imageway-env.d.ts; the plain ?img and trailing &img forms have static ambient declarations. A real TypeScript consumer compilation verifies directive imports and rejects an incorrect numeric-field assignment. Start the dev server/build (or CLI init later) after adding directive combinations. This avoids an unsafe catch-all module declaration.

Validation: lint, strict types, package build and **138 tests passed** under Node 24.22.0. Core coverage remains 100% lines / 98.82% branches. Full output: docs/validation/m2.txt. No full Svelte application or browser assertion is claimed yet.

## M3 — components implemented; size acceptance remains open (2026-10-20)

Implemented Image, Picture, BackgroundImage, ImageMeta, reactive subtree configuration, headless props, required alt types, snippets, native events, priority preload, responsive sources, CSS/no-JS previews, cached-image state and reduced-motion-aware reveal. Browser-safe code does not access window during SSR. Component declarations are generated and strict Svelte checking reports zero errors/warnings.

Validation: lint/types/package build and **141 tests pass**. Client and SSR example builds executed, followed by **3 Chromium E2E tests passing**: SSR without JavaScript, hydration without browser errors, image formats/dimensions, priority preload, loading/events/error UI, reduced motion, cached navigation and **CLS=0** on this controlled example. Preview fixture is original deterministic generated artwork, not an unlicensed photo. Logs: docs/validation/m3-*.txt.

**Measured size failure:** Image plus all reachable Imageway helpers is 2,776 gzip bytes (Svelte peer externalized), above the requested 1,536-byte target. See ISSUE-0001. M3 functional checks are green, but its full acceptance gate remains open. Continue independent integration work under the user's blanket authorization, preserve this as a release blocker, and revisit during packaging/size review; do not claim the complete Definition of Done.

## M4 — Kit runtime and principal providers (2026-10-20)

Implemented the composable Kit handle, framework-neutral Fetch service, Link-hint handle, exact adapter detection, adapter wrapper preserving current Vite/emulation hooks, native adapter construction (including Vercel image defaults), runtime/provider compatibility errors, and local/edge/generic/Cloudflare/Vercel/Netlify providers. Vite exports only a public whitelist into a virtual configuration module; switching configured providers does not require component edits. Format negotiation-only native APIs do not produce incorrectly labeled explicit picture sources. Cloudflare's documented AVIF fallback is represented honestly.

The service authorizes before cache lookup, bounds inputs/redirects/time/decode/workers, supports private-by-default responses, ETag/304/HEAD, immutable caching only for verified content revisions, and local request/transform budgets with an injectable shared guard. Additional review closed inherited-property key-ID/preset bypasses; adversarial regressions include a forged HMAC using a known inherited constructor string. Policy revisions are now included in signature context. No arbitrary request properties or signing keys are serialized to the browser.

Validation: lint, strict types, package build, zero Svelte errors/warnings and **149 tests passed**, portable core 100% lines / 98.85% branches. **Three actual Kit 3 builds** (basic/node/static) pass using current $app/tsconfig. Actual Node servers and the static output were fetched in Chromium: images rendered, correct MIME/priority, zero browser errors; runtime conditional HTTP returned 304. Produced client JS was scanned for real Node imports/Sharp/worker code. Logs: docs/validation/m4-*. Browser naturalWidth in the runtime record is density-corrected by srcset/sizes; decoded pixel dimensions are independently checked in pipeline/service tests.

Limits: Cloudflare/Vercel/Netlify URL conformance and adapter construction are verified locally, not their live paid/account behavior. CF URL mode needs an enabled zone; hosted named variants are fixed, not arbitrary transformations. Auto/unknown and community Bun/Deno adapters need an explicit verified target. The M3 full-entry size blocker remains open.

## M5 — Edge and standalone services (2026-10-20)

Implemented R2-key-only Cloudflare Worker, Images binding and operator-owned `cf.image` alternative, Cache API + R2 variants, shared Durable Object request/hour/month admission, signed access and protected purge by key/prefix/tag. Worker queues are bounded, transforms serialized to limit isolate memory. Input/output/pixel limits, response deadlines, Save-Data, ETag/HEAD/304, metrics and privacy-safe observation hook are included. Native operation timeouts cannot cancel upstream billing; the admission budget is not an account spending cap.

Executed `wrangler dev` with actual local Images/R2/Durable Object bindings: WebP 640×427 decoded, repeated request HIT, 304, HEAD, authenticated prefix purge, expired signature and metadata URL rejection. `wrangler deploy --dry-run` passed; no cloud resource was created. Local Images supports only basic resize/rotate/format; advanced production options remain documentation-verified, not cloud-executed. WASM fallback is deliberately absent: without a binding a clear 503 is safer than an unmeasured memory/CPU promise. Deno and Vercel/Netlify Edge require their native providers; the Sharp server targets Node/Bun.

Executed the same image/cache/conditional checks against standalone Node 24, Bun 1.4.3 and real Docker Compose with reverse proxy. The container runs as uid 1000, read-only root, all capabilities dropped, no-new-privileges and bounded resources. A task-owned isolated Lima VM supplied the Docker engine; no Docker Desktop/global configuration was installed. See `docs/validation/m5-services.json`. Protected admin routes require 32-byte tokens. Local caches and metrics are process/isolate scoped; deployment-level aggregation is operator-owned.

Gate: lint, strict types, package build, Svelte diagnostics and 158 tests passed. Portable URL/Accept core retains 100% line coverage, 98.85% branches. M3 component size issue remains open; M5 does not resolve it.

## M6 — Additional providers, CMS and fallback (2026-10-20)

Added Bunny, imgix, Cloudinary, ImageKit, explicitly unsafe/private imgproxy, IPX, Supabase, Fastly, CloudFront-v1-origin and Uploadcare subpaths, with public Vite descriptor reconstruction. Added exact-host CMS recognition, CMS URL translators and pre-generated Strapi/WordPress variant artifacts. Credentialed vendor signing/purge remains a server integration, never a browser secret. Added timeout/5xx circuit breaker with half-open recovery; 4xx/security/budget refusals cannot trigger original fallback.

Gate: 185 tests, lint/types/package/Svelte checks pass. Tests cover URL encoding/capabilities, domain boundaries, signed-source rejection, preserved attribution, CMS artifacts, provider switching and fallback admission/recovery. A real Cloudinary demo request returned WebP and was decoded; other paid-native paths are documentation-conformant URL tests, not account-backed execution. Official sources and exact restrictions: `docs/research/provider-contracts.md`. Existing component gzip release blocker remains open.

## M7 — Build publication (2026-10-20)

Added `StorageTarget`, content-verified manifests, bounded parallel incremental uploads, transient retries, resumable HEAD checks, no-network dry-run and conservative previous-manifest GC. Implemented optional SDK targets for S3/R2/B2, Vercel Blob and Supabase, plus Bunny HTTP Storage. Vite rewrites only Imageway artifacts and emits `image-manifest.json`; no application-global asset base is overwritten. Secrets are build/server environment variables.

Gate: lint/types/package/Svelte checks and 189 tests pass. Actual Vite build verifies remote asset URLs and unchanged unrelated URLs. Storage mutation tests use a local in-memory target; production target SDKs are type-checked against installed versions, not live account uploads. No cloud credentials or resources were created. Details/constraints in `docs/guides/publication.md`. Paid staging upload remains an operator validation, and M3 gzip blocker remains open.

## M8 — CLI (2026-10-20)

Added Node-shebang CLI and `./cli` API: parser-aware idempotent init, batch optimize/dry-run/watch, static Svelte/Markdown/CSS audit with CI exit codes/JSON, nonmutating deployment preparation, protected Worker purge and conservative import/markup codemods with backups. Optional Sharp now installs with the package where supported; missing native codecs still produce actionable errors. TypeScript is a CLI-only dynamic dependency and is not reachable from browser entry points.

Gate: lint/types/build/Svelte checks and 194 tests pass. Executed compiled CLI under Node and Bun, including a bin symlink (important for npx), init/dry-run/idempotence, deployment generation/non-overwrite, actual encoded batch output, static audit and parseable migration output/backups. Migration intentionally reports unsupported patterns for review; no claim of full arbitrary app conversion. No paid deployment/purge was executed by CLI. Fresh packed-consumer timing and watch smoke are reserved for final packaging checks.

## M9 — Independent security and integration gate (2026-10-20)

Replaced regex-only SVG screening with bounded strict XML parsing and an exact geometry/attribute whitelist. Added namespace/malformed/escaped-CSS/DTD/CDATA regressions; added portable GIF/WebP/APNG frame-count checks and still-AVIF policy before Worker decode. Shared Sharp admission now bounds aggregate per-import concurrency, queued input bytes and queue time, retaining slots until worker exit. Node HTTP admission is bounded at eight. Cache file reads reject oversized entries. Defaults are deeply frozen. CSS URL escaping covers controls and raw-text delimiters.

Security fixes: a present zero expiry cannot bypass signing; public signed TTL cannot outlive authorization and cannot use SWR; Save-Data can lower quality of locked presets after authorization without breaking their signatures; formats disabled in config are rejected by Worker. Cache-reload browser testing found and fixed a placeholder reveal flash: only a resource with actual transferred body bytes animates; cached/304/unknown-timing images stay visible.

Gate: 208 tests; lint, strict types, package build and Svelte diagnostics pass. Portable core: 99.46% lines, 99.11% branches, 100% functions. This is coverage of core policy, URL, signing, negotiation and raster inspection, not a claim of 99% coverage for every CLI/provider/native dependency. E2E verifies real Worker/Docker HTTP bytes/cache/304/HEAD/SSRF/traversal/admin denial, SSR/no-JS, priority preload, dimensions, callbacks, reduced motion and cached reload. Chromium's supported layout-shift observer reports CLS=0. WebKit and Firefox use functional layout/dimensions checks; no fabricated CLS metric on unsupported observers.

Chromium/WebKit run on macOS; Firefox's macOS process failed before test startup with the upstream macOS 27 profile/TCC problem ([Playwright report](https://github.com/microsoft/playwright/issues/42768)). Firefox was then run in the matching official Playwright 1.64.1 Linux container, with a read-only repository mount, isolated profile and loopback-only network bridge. No personal browser profile or macOS privacy setting was modified. Native Worker binding actually encoded AVIF/WebP/JPEG/PNG at 640×427; offline GIF returns an explicit 422 capability error. Production GIF/advanced transforms remain unverified against a paid binding. Node/Bun/Docker smokes remain green; complete threat model and operational boundaries in SECURITY.md. Gzip acceptance remains open.

## M10 — Package documentation, examples and measurements (2026-10-20)

The user deferred the documentation website. Its draft and generator are preserved under extras/, preview stopped, excluded from the active workspace. No website was published. README now documents actual installation, components, providers, CLI, security and preview limitations; the npm package has its own README and MIT license. Supporting guides and current official cost/topology research remain in the repository.

Actual benchmarks exposed excess worker startup overhead. Workers are now reused with bounded queue bytes/time and idle expiry; unnecessary per-variant previews are skipped, and build previews decode a small image once. Error recovery and byte admission are exercised by compiled-worker regression checks. Root lint/types/build/Svelte/208-test coverage gate passed; the focused worker suite passes after the additional recovery assertions.

Final three-run medians: Imageway build cold 314.9 ms / warm 52.5 ms; imagetools 145.7 / 39.0; enhanced-img 149.6 / 38.9. The build parity target remains unmet (ISSUE-0002). Six resized WebP/AVIF outputs from three original synthetic sources reduced weight by 92.0% median; this is not a perceptual quality comparison or real-photo generalization. Runtime cold/warm TTFB medians 90.1/0.9 ms versus IPX 47.9/23.7 ms; warm numbers compare built-in caching with bare IPX, not encoder speed. Worker local timings are labeled emulator-only. Reproduction and raw evidence: bench/README.md and bench/results/.

Lighthouse 13.5.0 on the package component fixture actually reports **99/100**, CLS **0**, LCP **1.61 s**, TBT **84 ms**, with LCP discovery and unsized-image audits passing. Exact 100 remains open (ISSUE-0003). Full Image entry remains above 1,536 gzip bytes (ISSUE-0001). These are retained acceptance failures; no 1.0 claim is made.

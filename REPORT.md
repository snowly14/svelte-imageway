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

# 1.3.1 finite-build scheduling

The real lunar-web integration exposed a batch waiting longer than the runtime queue deadline while generating 21 default variants. Finite Vite build jobs now wait outside request admission, globally bounded by the shared pool's configured concurrency. Each admitted transform retains the original decoding/worker deadline. Runtime HTTP queue count/byte/deadline limits are unchanged.

A real 70-job worker batch passes even with the runtime queue disabled; simultaneous runtime admission is still rejected at capacity, and errors release build slots. The lunar-web candidate build now passes with the default transform deadline and reports zero Svelte/TypeScript errors. Complete CI and public provenance verification are required before this patch is reported published.

The timing table below records the 1.3.0 candidate before this scheduling patch. It is not a 1.3.1 timing or general speedup claim.

---

# 1.3.0 measured improvements

Local measurements on 21 October 2026:

- StaticImage entry: 1196 gzip bytes; complete Image: 3158 bytes, Svelte peer externalized. The smaller component omits provider/snippet/transition features; the complete component still exceeds the original 1536-byte stretch target.
- The local 1676x1133 JPEG generated 21 files / 1,732,502 bytes with all default formats. Default dominated-AVIF selection emits 14 files / 1,019,864 bytes. At full width the browser can select WebP 189,046 bytes instead of AVIF 279,043 bytes. Both encodings are still computed; same numeric encoder qualities are not proof of equal perceptual quality.
- Seven alternating baseline/current build pairs verify byte-identical outputs. Cold medians 1312.9 → 1328.3 ms; warm 219.3 → 218.7 ms, with substantial spread (cold samples 1287.9–1401.2 ms). No speed improvement or build parity claim. See bench/results/comparison.json. The prepared/shared-source experiment was removed.
- Current HTTP benchmark: Imageway cold median 314.8 ms / warm 3.46 ms / burst 355.6 requests/s; IPX cold 217.4 ms / warm 102.64 ms / burst 40.1 requests/s. Imageway has built-in cache; bare IPX does not. This is not a pure encoder or production-CDN comparison, nor a controlled speedup over the historical session.
- Exclusively owned exact-sized worker outputs transfer without redundant copies; pooled/partial/shared allocations retain safe fallback handling. Decoding limits, queue admission, deadlines and encoder settings are preserved.
- Local validation: 227 tests, strict TypeScript/Svelte checks, both component budgets and package export/tar validation. Chromium/WebKit: ten component tests passed; optional service fixtures skipped.
- Local tests cover source offsets, explicit/default format selection, opt-out, typed StaticImage inputs, SSR escaping/preload alignment/preview sanitization, and browser loading with/without JavaScript. Optional Worker/Docker browser fixtures remain skipped when unconfigured. Complete 1.3.0 CI/publication status is recorded only after those steps complete.

---

# 1.2.0 release validation

The user requested version 1.2.0 and capability-driven hybrid optimization. The historical preview report below remains a record of the original acceptance work; its unmet stretch targets are not claimed as achieved by this version.

- Local validation: 219 tests passed; strict TypeScript, Svelte diagnostics and lint passed.
- Chromium and WebKit: eight component/browser tests passed; four optional service scenarios skipped (not configured in this browser run).
- New runtime integration verifies that one component-generated URL negotiates actual WebP/JPEG bytes, distinct ETags and cache reuse, with unsupported Accept rejected.
- Automatic build widths for a 1676px input: seven instead of eight; three formats generate 21 rather than 24 variants (12.5% fewer transformations). Explicit widths are unchanged. This is a count reduction, not a measured universal speedup.
- Image entry: 3158 gzip bytes with Svelte externalized; passes the existing 3400-byte release budget, exceeds the original 1536-byte stretch target. Original benchmark results below predate 1.2.0.
- Complete Linux/macOS/Windows Node 22/24 CI and Chromium/Firefox/WebKit CI passed for source commit `002158b09e123e70685dbb7d269dc5981de8b20d`.
- npm 1.2.0/latest and provenance were verified against that source and the downloaded tarball SHA-512. GitHub v1.2.0 carries the registry archive and checksum.
- npm processing took several minutes; negative tarball responses were briefly cached at the CDN. Registry verification now bypasses stale tarball responses and can run without republishing.

---

# Project report

## Current status

**0.1.0 published on npm and GitHub; registry installation, tarball integrity and provenance verified on 21 October 2026. This remains a preview, not the completed 1.0 Definition of Done. No paid cloud deployment has been performed.**

The user's latest instruction defers the website. Its files and maintenance scripts are preserved in `extras/`, its preview is stopped, and it is excluded from workspaces/checks. Work now targets the package and README. Bun replaces the original brief's pnpm requirement. The user authorized continuous M1–M11 execution with checks between milestones.

Baseline: Svelte 5.57.2, Kit 3.1.0, Vite 8.3.4, TypeScript 6.0.3, Node 24.22.0 and 22.23.3 LTS, Bun 1.4.3. Versions, costs and limits were researched against official sources; no repository owner, contact, funding URL or npm credentials were invented.

Architecture: [ADR](docs/adr/0001-architecture.md), [URL contract](docs/spec/url-contract.md), [research](docs/research/versions-and-compatibility.md), [costs/topology](docs/research/platforms-and-costs.md), [release instructions](RELEASE.md). Detailed milestone evidence follows the current checklist.

## Executed evidence

| Gate                                                            | Actual result / boundary                                                                                                                                      |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bun install and frozen lock                                     | Executed; root lock committed, standalone production lock prepared                                                                                            |
| ESLint / strict TypeScript / package build / Svelte diagnostics | Pass on Node 24; zero Svelte errors/warnings                                                                                                                  |
| Unit/security/pipeline/provider/CLI tests                       | 215 pass across the remote Node 22/24 matrix on Linux, macOS and Windows                                                                                      |
| Portable core coverage                                          | 99.56% lines, 99.11% branches, 100% functions after formatting; not whole-repository coverage                                                                 |
| Vite/Kit examples                                               | Real builds, static/node HTTP and rendered-image checks; M2–M4 logs                                                                                           |
| Worker / Docker / Node / Bun                                    | Real local bindings and real task-owned Docker engine exercised; final rerun passes, see M11 evidence                                                         |
| Browser E2E                                                     | M9 Chromium/WebKit on macOS, Firefox in official Linux container passed; final rerun passes, see M11 evidence                                                 |
| Packed consumer                                                 | Real archive installed in a new minimal Kit 3 project, CLI init, build, strict Svelte check, image decode/preload pass in 19.2 s with warm Bun registry/cache |
| Package inspection                                              | publint passes; ATTW ESM-only passes with internal errors fixed; pack allowlist/bin/worker/README/license checks and npm dry-run executed                     |
| CLI watch                                                       | Real source rewrite produces a new variant; original preserved and generated output excluded                                                                  |
| Lighthouse                                                      | 99/100, CLS 0, LCP 1.61 s, TBT 84 ms on component fixture; exact 100 target fails                                                                             |
| Full Image entry                                                | 3,057 gzip bytes in M10, Svelte peer external; original 1,536-byte target fails                                                                               |
| Benchmarks                                                      | Real three-run build/runtime samples; build parity fails; raw files in bench/results                                                                          |
| Remote OS CI / cloud uploads / npm provenance publication       | OS matrix passes; npm 0.1.0 and provenance verified; paid cloud uploads remain unverified                                                                     |

## Public release verification — 21 October 2026

- [npm package](https://www.npmjs.com/package/svelte-imageway): operational version 0.1.0 is present under both `next` and `latest`.
- [GitHub release](https://github.com/snowly14/svelte-imageway/releases/tag/v0.1.0): source commit `4ef4a5f371728fabd17db12e527629cb49866491`.
- [Full CI matrix](https://github.com/snowly14/svelte-imageway/actions/runs/39503077450): Linux, macOS and Windows on Node 22/24 plus browser job pass.
- [Registry upload with provenance](https://github.com/snowly14/svelte-imageway/actions/runs/39506359230): succeeded. npm initially exposed a staging placeholder before the operational version became available; registry availability was verified separately. A repeat upload was rejected because 0.1.0 was already published, so no version was overwritten.
- Fresh Bun registry install and Node 24 consumer: core/provider/props imports, actual 64×32 WebP processing and cache HIT pass.
- Downloaded npm tarball SHA-512 matches registry integrity. The SLSA provenance subject digest matches that tarball and resolves to the published source commit. Packed file contents match the GitHub release archive.
- Trusted publishing is configured for `snowly14/svelte-imageway`, `release.yml`, environment `npm`, with publish/stage-publish permissions. The temporary GitHub npm secret was removed. Revoking the separately created temporary npm token still requires the maintainer's MFA; no claim of token revocation is made.

## Requirements checklist

Checked means implemented and supported by the stated local tests. An unchecked item is an unmet target, deferred scope or unverified external behavior. Test results do not imply every production configuration was exercised.

### Performance

- [x] Priority attributes, matching head preload and Link hook; dimensions/aspect ratio and controlled-example CLS 0.
- [x] No browser image processing; responsive AVIF/WebP/fallback, bounded widths, DPR and Save-Data quality policy.
- [x] Lazy off-screen loading, sizes auto fallback, cached hydration and reduced-motion behavior exercised.
- [x] GIF/WebP animation and explicit first-frame handling; frame/pixel limits exercised.
- [ ] Exact Lighthouse 100 and component <1.5 KiB gzip: measured failures, ISSUE-0001/0003.
- [ ] Build parity with imagetools: follow-up medians 274.52/49.50 ms versus 144.19/39.15 ms cold/warm; ISSUE-0002.
- [ ] Perceptual quality adaptation, AVIF decode-cost study and production 103 Early Hints: not established. No universal INP claim.
- [ ] Animated AVIF/video: unsupported; Client Hints are not automatically trusted as cache dimensions.

### Reliability

- [x] 404/broken-image snippets/events, deadlines, eligible timeout/5xx fallback and half-open recovery.
- [x] Corrupt/oversized images, decompression limits, EXIF orientation/GPS removal, ICC/CMYK/alpha exercised.
- [x] Reusable bounded workers, admission byte/time limits, atomic cache writes and anti-stampede.
- [x] Warm cache hit target >95%: 100% on documented repeat workload.
- [ ] HEIC/JXL conditional on real codecs; BMP/ICO unsupported. TIFF and restricted SVG pass; this is not all-exotic-format support.
- [ ] Native production Cloudflare animation/advanced operations: documentation-backed, account execution absent.

### Security

- [x] Mandatory exact HTTPS origin allowlist, DNS connection pinning, redirect reauthorization, private/metadata/mapped/encoded IP denial.
- [x] Local realpath containment/final symlink protections; configured roots require trusted writers.
- [x] HMAC canonicalization, expiry including zero, rotation and authorization before cache/304.
- [x] Private default cache; signed public TTL clamped to authorization, no signed SWR; immutable only verified content revisions.
- [x] Locked presets, bounded transforms/input/output/pixels/frames/queues/time and local/shared admission guards.
- [x] Magic bytes and strict bounded SVG XML/geometry whitelist, including escaped CSS/namespace/DTD/active-content regressions.
- [x] Browser bundle checks reject Node/Sharp leakage; public config excludes server credentials.
- [x] Authenticated Worker purge/metrics, explicit CLI purge confirmation, no implicit source deletion or billed deployment.
- [x] SECURITY.md documents threat boundaries, dependencies and adversarial fixtures; no claim of an external security audit.

### Developer experience

- [x] Local zero-account imports, one plugin, typed artifacts, required alt, subpath exports and schemas.
- [x] Image/Picture/BackgroundImage/ImageMeta, headless props and reactive subtree context; native attributes/events and loading/error snippets.
- [x] Actionable codec/config/runtime errors and lazy Sharp loading.
- [x] CLI init/optimize/audit/deploy/purge/migrate; dry-run, watch, JSON/exit codes, plain NO_COLOR-compatible output.
- [x] Parser-aware idempotent init and conservative migration with backups/review diagnostics.
- [ ] Arbitrary migration patterns are intentionally not auto-rewritten; public API JSDoc exists but exhaustive prose for every exported helper is not claimed.
- [ ] Website/playground deferred by user; developer overlay and preprocessor remain optional roadmap work.

### Ecosystem

- [x] Actual static/node Kit builds, SSR/no-JS/hydration, Vite dev laziness/HMR/cache/production assets.
- [x] Cloudflare/Vercel/Netlify adapter wrappers preserve hooks and have type/conformance checks. Auto needs an explicit actual target.
- [x] Bun standalone service verified; Deno/edge use native providers or fail clearly, not fictitious official adapters.
- [x] CMS helpers: Sanity, Contentful, Directus, Storyblok, Prismic, DatoCMS, Shopify, Unsplash; Strapi/WordPress variant artifacts.
- [x] Additional provider capability/URL tests and explicit unsupported transform/signature/purge limits.
- [x] Publication manifests, dry-run/resume/retries/GC and static CDN URL rewrite tested with an in-memory target; SDK signatures type-checked.
- [ ] Real account R2/S3/Bunny/B2/Blob/Supabase uploads and paid native deployment remain unverified.
- [ ] Dedicated streaming/103 transport matrix, mdsvex/Storybook/Tailwind/PWA fixtures: not implemented/tested. Existing hooks do not buffer arbitrary streamed pages.

### Accessibility, SEO and privacy

- [x] Type-required alt, explicit decorative empty alt, translatable strings, reduced motion and useful SSR/no-JS/cache behavior.
- [x] Dimensions and real images convey content; placeholder color is supplementary.
- [x] Open Graph/Twitter/image_src helpers with dimensions/MIME; audit diagnostics for alt/dimensions/loading/formats/weight/LCP review.
- [x] GPS removal tested; no package telemetry or default client-IP/source-query logging; retention/operator responsibilities documented in SECURITY.md.
- [ ] Optional image sitemap utility and measured assistive-technology audit are not delivered.

### Costs and maintenance

- [x] Official dated provider costs/free tiers and CDN topology/cache recipes; distinct storage/transform/delivery costs, no included-CDN claim.
- [x] Worker shared Durable Object guard and Node injectable shared guard; local metrics/admission scopes documented. Neither is a provider spending cap.
- [x] MIT, contributing/conduct/security, issue/PR templates, Changesets config/changelog and version/deprecation policy prepared.
- [x] Package files restricted; README/license/bin/worker declarations, tree shaking and ESM type resolution checked.
- [x] Preview CI enforces a 3,400-byte gzip regression budget; original strict 1,536-byte command remains failing and blocks a 1.0 claim.
- [ ] GitHub Actions Node LTS × Linux/macOS/Windows matrix prepared but no remote run exists.
- [ ] Actual repository/bugs/homepage/funding/contact identity requires a real public repository; release validation refuses absent metadata. Funding omitted unless real.
- [ ] Provenance-enabled release workflow prepared, not executed. Exact upload command in RELEASE.md requires actual trusted-publisher configuration.
- [ ] npm 0.1.0 next publication and later 1.0: not executed.

## Benchmarks and acceptance

See [bench/README.md](bench/README.md) for dataset generation, exact versions, three-run protocols, quality caveats, output counts, RSS and raw samples. Median reduction is 92.0% across six resized synthetic outputs; not a real-photo/perceptual comparison. Runtime cache comparison is Imageway's built-in cache versus bare IPX. Local Cloudflare binding timings are not production-CDN timings.

## Remaining release work

Close ISSUE-0001/0002/0003, validate missing codecs and external platform/account behavior, run the remote OS matrix, configure real release identity/private community contact, and perform an authorized provenance publication before making a complete 1.0 claim. Optional v1.x work includes overlay/preprocessor, sitemap, additional presentation components, video, Storybook/PWA examples and deeper vendor features. The deferred website requires a new explicit direction before reactivation.

The Mac must not be shut down merely because a preview archive exists: the user tied shutdown to actual completion. Sleep prevention remains session-scoped while this original acceptance work remains unfinished. No permanent system power preferences were changed.

## Milestone history

The following records describe the evidence at each commit; current measurements and acceptance state above supersede historical values.

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

## M11 — Preview packaging and release preparation (2026-10-20)

Prepared Bun/Changesets versioning, initial changelog, Conventional Commit hooks, staged formatting, contributing/conduct/issue/PR documents, a pinned GitHub Actions Node 22/24 × Linux/macOS/Windows matrix, and a manually dispatched provenance release workflow restricted to 0.x previews. No GitHub workflow has actually run: the repository is local with no remote. Real repository metadata is intentionally required by release:metadata; no owner/funding/contact was fabricated.

Fixed provider declaration inference so safe subpaths do not depend on the Svelte component entry. Added NodeNext arbitrary-extension declaration aliases alongside svelte-package’s bundler declarations. publint and ATTW esm-only pass across all 31 export entries; internal type resolution errors are fixed rather than disabled. The unsupported Node10/CommonJS paths are explicitly excluded by the ESM profile. Bun pack and npm pack dry-run inspect 148 restricted package files, including README/MIT/changelog, executable CLI, components and compiled Sharp workers; no extras/site or local state ships.

Actual final checks: 208 unit/security tests on Node 24.22.0 and Node 22.23.3; strict types including bench/scripts, ESLint, package build, Svelte diagnostics and Prettier pass. The package fixture builds client and SSR output. Final E2E passes **10 Chromium/WebKit macOS + 5 Firefox Linux** cases, including real Worker and Docker HTTP. Standalone Node/Bun/Worker/Docker smoke checks validate decoded WebP 640×427, HIT, ETag/304/HEAD, policy/admin denial and protected purge/metrics. Docker was rebuilt with a standalone frozen production lock and inspected healthy, node user, read-only root, all capabilities dropped and no-new-privileges.

The final tarball was installed independently into a new minimal SvelteKit 3 project. Actual Node 24 build, CLI init, strict Svelte check, browser decode/preload and fetched WebP **640×427** pass in **19.2 seconds**, with a warm local Bun registry/cache. Browser naturalWidth is density-corrected; encoded pixels are independently decoded. This is not a network-cold installation guarantee. A real CLI watch rewrite produces a new hash while retaining the source.

The preview regression budget passes at **3,057 gzip bytes** with a 3,400 ceiling. The original strict command was also actually run and **fails** at its 1,536-byte target. Build parity and exact Lighthouse 100 likewise remain open. The three issues and the current checklist retain these blockers. RELEASE.md contains exact audit/upload commands and the required real identity/OIDC setup. No npm upload, provenance attestation, live storage upload or paid deployment was performed; 1.0 is not ready.

Validation artifacts: docs/validation/m11-*. Final package and a readable copy of this report are also placed in the chat outputs folder. The site stays preserved and inactive. Sleep prevention is retained because the original full acceptance work remains unfinished; shutdown has not been triggered.

# Project report

## Current status

**Phase 0 research and design prepared on 2026-10-19. M1 awaits user approval. No package implementation or publication exists.**

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
- [ ] Obtain user approval to start M1.

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

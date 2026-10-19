# Milestone plan and approval gates

Date: 2026-10-19. The original brief requires a plan before code and explicit approval between milestones. Phase 0 contains research, design documents and this plan only. **M1 has not started.**

Every implementation gate requires the relevant tests actually run, clean lint, successful strict type checking, an updated REPORT.md, a Conventional Commit and a short status note. Introduce meaningful tests with each capability. M9 independently challenges security already built in M1 onward; it is not permission to defer basic protections.

| Gate | Work | Evidence required before completion |
| --- | --- | --- |
| Phase 0 | Registry versions/names, competitive analysis, cost/topology constraints, architecture/URL ADRs, plan | Source links and raw registry results; docs validation; no invented implementation results; user approves M1 |
| M1 | Bun workspace; portable core; optional Sharp pipeline; secure local/remote source acquisition; bounded worker pool; memory/disk cache; v1 normalization/signing/presets; machine schemas | Node 24 baseline; strict types; lint; real JPEG/PNG/WebP/AVIF/SVG/GIF/orientation/CMYK/corrupt/pixel-limit tests; SSRF/traversal/expiry tests; >90% core coverage; cache invalidation, anti-stampede and bounded variant evidence |
| M2 | Vite typed `?img` imports/directives, responsive artifact metadata, formats and placeholders, persistent cache, lazy dev generation, HMR, hashed emission | Real Vite build and dev/HMR requests; fixture output dimensions/MIME; incremental/cache tests; SVG policy; actionable absent-codec/Sharp errors; server code exclusion |
| M3 | Svelte 5 Image/Picture, headless props, BackgroundImage/ImageMeta, subtree context, loading/error snippets and native events | SSR and hydration/browser tests; required alt type tests; priority preload matching; no-JS and cached-image display; reduced-motion checks; actual gzip budget <1.5KB measured for the base component |
| M4 | Kit composable handle and `imageAdapter()`; static/node/auto/native strategies; local/edge/generic/cloudflare/vercel/netlify providers | Real basic/static/node example builds and requests; native provider URL/adapter artifact conformance; no Sharp in edge/browser bundles; Link header behavior and streaming limits documented |
| M5 | Worker Images binding/cf.image path, Cache API/R2 hooks, Node/Bun service and hardened Docker image/compose proxy; bounded cost/rate controls and observability | Actual `wrangler dev` requests; distinguish offline binding support from remote production; actual Node/Bun service; actual Docker Compose health/format/cache checks when engine available; non-root and resource-limit evidence; WASM only if measured and justified |
| M6 | Bunny/imgix/Cloudinary/ImageKit/imgproxy/ipx/Supabase/Fastly/CloudFront; CMS URL helpers; fallback/circuit breakers; optional Uploadcare assessment | Official API mapping and declared capability matrix; deterministic URL vectors; CMS source/signature preservation; timeout/5xx recovery; no fallback on policy failure; mocks vs live tests clearly labeled; resolve pending API/cache research |
| M7 | Publication: R2/S3/Bunny first, B2/Blob/Supabase-compatible targets, versioned manifest, incremental retries/resume/dry-run, generated-URL rewriting | Local/fake target tests plus explicitly authorized live integration when credentials available; second upload skips unchanged bytes; aborted upload resumes; static example CDN URLs verified; GC cannot delete active/unknown artifacts |
| M8 | CLI init/optimize/audit/deploy/purge/migrate, dry-run, watch, NO_COLOR and CI exits | Real temporary projects and source fixtures; parser-aware idempotent config migration; codemod regression tests; watch updates; actionable errors; destructive/billable actions require explicit approval |
| M9 | Independent security and E2E review across route, Worker and Docker paths; fuzz malformed requests; privacy and cache isolation | Playwright against built examples; `wrangler dev`/Miniflare tests; actual `docker compose` tests; DNS/redirect/rebinding/IPv6/traversal/SVG/bombs/expiry tests; hit rate >95% on precisely defined warm workload; no skipped infrastructure check reported green |
| M10 | Docs/playground, examples/guides/recipes/migration/topology/security/PWA, current cost matrix and reproducible benchmarks | Docs build; all published examples executed; measured weight median >=60% on declared fixtures or target explicitly failed; cold/warm builds vs enhanced-img/imagetools; TTFB/throughput/RSS vs ipx and native Cloudflare where testable; Lighthouse/CLS/LCP results with conditions |
| M11 | Export/ESM/type/package audit, Changesets/release/CI, governance files/templates, compatibility/deprecation policy, final report | Packed consumer tests, tree-shaking/server-leak checks, publint/arethetypeswrong, `npm pack --dry-run` metadata inspection, actual CI Node LTS × Linux/macOS/Windows results; provenance release configuration; exact owner/repo/npm commands resolved before publication |

## M1 concrete work order

1. Provision an isolated Node 24.22.0 runtime and initialize a Bun workspace with exact selected development versions and a committed lockfile.
2. Define public portable types, configuration validation, errors and schemas; keep server entry points physically separate.
3. Implement v1 strict parsing, normalization, preset restrictions, canonical strings, signing/rotation/expiry and Accept negotiation with deterministic vectors.
4. Implement safe local acquisition and bounded remote fetch with injected DNS/connection primitives for security tests. Deny unsupported runtime security guarantees.
5. Add lazy Sharp capability probing, EXIF orientation/metadata policy, bounded encoders/worker pool and honest unsupported-format results.
6. Add content/pipeline-addressed disk cache, byte-bounded memory LRU, atomic writes and concurrent deduplication.
7. Execute lint/types/unit/security/pipeline/coverage checks. Record real results and a Conventional Commit. Present the M1 review and wait for M2 approval.

## Platform and acceptance caveats

- Docker is not installed on the current host. Do not install a Docker Desktop app or change system services casually; determine a supported local engine/CI route at M5. If unavailable, keep the gate explicitly unverified.
- Cloud account credentials are not assumed. Local Worker behavior does not validate paid-service quotas or production transforms. Never run a billable deployment without explicit confirmation.
- Node 26 is currently installed, while Node 24 is the baseline LTS. Do not silently replace the global runtime.
- A zero-config remote proxy conflicts with an obligatory SSRF allowlist. Zero-config applies to local assets; remote origins must be authorized.
- HEIC/JXL/BMP/ICO and animated AVIF/video require capability detection or additional decoders. A documented rejection is honest but does not satisfy a success criterion requiring actual support; record unmet requirements.
- Lighthouse 100, CLS=0, 60% median weight reduction and equal/faster builds are measured release gates, not promises that a library can guarantee for arbitrary applications.
- Optional bonuses (preprocessor, overlay, Markdown/mdsvex, Avatar/Grid, sitemap, Storybook/Tailwind) have explicit roadmap status until implemented and tested.

## Power controls and finalization

The user requested sleep prevention until completion and Mac shutdown after completion. A session-owned launchd job runs `caffeinate`; it does not rewrite permanent system power settings. Operational state is in ignored `.local/power-state.md`.

At intermediate review gates, keep the assertion active and leave the Mac running. On cancellation, remove it. At genuine final completion, save all files, commit, record remaining limitations and the final status for the user, then remove the assertion and request a normal macOS shutdown without force-quitting applications. Never mark M11 complete to trigger shutdown while required work is still unverified.

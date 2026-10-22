# Release policy and commands

3.0.0 is published on npm under latest and on GitHub. StaticImage/StaticPicture are removed; optional BlurHash previews use a bounded Rust/WASM kernel. CI 39824245768 and release 39824246208 pass for source 988fc34af9b5e8d7bf41ea10bf26fcb3fe861aea, including native artifact reproduction and Linux browsers. Registry integrity/provenance and a fresh registry consumer are verified. See docs/validation/release-3.0.0.json. See REPORT.md.

2.0.0 is published on npm under latest and on GitHub. Ordinary raster imports work without generated declarations; Image/Picture markup is explicit. CI 39818713025 and release 39818727559 pass for source 36280a43b8149b6ea3cfa920007c56152ef11397. Public integrity/provenance and a fresh registry SvelteKit consumer are verified. See REPORT.md and docs/validation/release-2.0.0.json.

1.5.0 is published with parsed representation cache, frozen policy fingerprint, typed native codec inventory and JPEG XL decoder diagnostics. CI 39670903349 and release 39670903149 passed; registry integrity and provenance match source 0cc46cc9de80c17e4918317e6a5759bda10c69c0. See REPORT.md.

1.4.0 is published on npm under latest and on GitHub. Immutable prepared sources and bounded build parallelism have paired byte-verified measurements. The complete CI matrix, public registry integrity/provenance verification and fresh registry consumer pass for source `571136a0f44b91fb75893d84bb71c573e24200cc`. See REPORT.md.

Previous version 1.3.1 was published on npm under latest and on GitHub. Source/provenance commit: `06f2c634ed51759cc11091df37ce64360c49c49b`. The complete Node 22/24 Linux/macOS/Windows CI and Chromium/Firefox/WebKit checks passed; the release workflow verified registry integrity and provenance. lunar-web installed the registry package with Bun, passed strict checks/build and loaded one responsive WebP with a matching preload. Earlier versions remain immutable. Performance stretch targets remain documented, not implied by version numbering.

## Configure real identity

The public repository is [snowly14/svelte-imageway](https://github.com/snowly14/svelte-imageway). Package repository, homepage and issue metadata point to that repository. Private vulnerability reporting is enabled. npm ownership is configured, and trusted publishing is connected to this repository, workflow `release.yml`, and environment `npm`. No npm token is stored in GitHub.

```sh
IMAGEWAY_REPOSITORY=https://github.com/snowly14/svelte-imageway bun run release:metadata
```

Funding is omitted because no funding destination was supplied. Never commit npm credentials; authenticate locally with `bunx npm login` or configure npm trusted publishing for the release workflow.

## Local preparation

```sh
bun install --frozen-lockfile
bun run check
bun run format:check
bun run build:components
bun run test:e2e
bun run package:check
bun run check:budget
```

`package:check` runs publint, Bun tar creation, tar allowlist checks, ATTW's ESM-only profile, and the explicitly requested `npm pack --dry-run`. Legacy Node10/CJS require is unsupported; internal type errors are not ignored. Build components and configure local Worker/Docker fixtures for service E2E; a remote OS matrix is unverified until the actual repository runs CI.

For subsequent releases, run `bun run changeset` with each user-visible change. `bun run version:packages` consumes the reviewed changesets and updates changelogs; then `bun install`, review versions/changelog/lock and commit. Keep public API compatibility within each stable major; 0.x minor versions may break APIs with migration notes. Deprecations receive a documented replacement before removal in a later minor preview or stable major.

## Publish with provenance

Bun remains the dependency manager and runs all scripts/builds/packing. [Bun publish cannot generate provenance](https://bun.sh/docs/pm/cli/publish), so the final registry upload uses npm only for publishing the audited tarball. [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) requires the actual public GitHub repository/workflow and authorized package configuration. The first package creation may use an authenticated npm session supplied as the temporary repository secret `NPM_BOOTSTRAP_TOKEN`; the upload still runs on GitHub with `--provenance`. Remove this secret immediately after bootstrap. Configure the npm trusted publisher for subsequent releases. Never commit credentials or publish without provenance.

The prepared `release.yml` runs only by manual dispatch on main, in the `npm` environment. Configure that environment's required reviewers and npm trusted publisher before enabling it. It verifies the exact requested version and repository metadata, runs the package gate, and executes:

```sh
npm publish .local/pack/svelte-imageway-3.0.0.tgz --tag latest --access public --provenance
```

That command is for the supported CI/OIDC environment, not a promise of provenance on an arbitrary local shell. Check the registry and GitHub release before announcing publication; an uploaded GitHub repository does not imply that npm publication succeeded. Paid cloud deployment is outside this package release. Verify the registry tar integrity, metadata, latest dist-tag and provenance before announcing a release.

Version 1.2.0 uses the existing full CI/package/browser gates and provenance. Its requested version is not a claim that original stretch targets have passed.

## First publication result

If npm reports that the package is being processed, the upload succeeded but public availability may lag. Never republish the same version to retry verification. Dispatch the release workflow with `verify_only=true` and the exact version; it skips publication and allows up to 20 minutes for registry availability, integrity and provenance verification.

Version 0.1.0 was uploaded with GitHub Actions provenance and later became operational in the public registry. Initial staging placeholders are not evidence of an installable release. The workflow now verifies the exact version, `latest` tag, tarball integrity and provenance metadata after uploading. An existing published version is immutable; do not rerun its publish command as a verification step. Prepare a new reviewed version for subsequent releases.

A new project installed the registry preview with Bun and verified real WebP output and cache reuse. The source/provenance commit is `4ef4a5f371728fabd17db12e527629cb49866491`. Current details are in REPORT.md.

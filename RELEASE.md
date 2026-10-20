# Release policy and commands

This checkout prepares 0.1.0 for `next`; nothing has been published. 1.0 is blocked by the documented size/build/Lighthouse targets and codec/cloud verification gaps. The preview CI enforces a 3,400-byte full Image gzip regression budget; `bun run check:acceptance-size` enforces the original 1,536-byte target and currently fails. Do not describe the preview budget as meeting the original target.

## Configure real identity

The public repository is [snowly14/svelte-imageway](https://github.com/snowly14/svelte-imageway). Package repository, homepage and issue metadata point to that repository. Private vulnerability reporting is enabled. The first npm publication still requires an authenticated npm account authorized for the available package name.

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

Bun remains the dependency manager and runs all scripts/builds/packing. [Bun publish cannot generate provenance](https://bun.sh/docs/pm/cli/publish), so the final registry upload uses npm only for publishing the audited tarball. [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) requires the actual public GitHub repository/workflow and authorized package configuration. The first package creation may require authenticated account setup before OIDC can be configured; do not invent credentials or publish without provenance as a workaround.

The prepared `release.yml` runs only by manual dispatch on main, in the `npm` environment. Configure that environment's required reviewers and npm trusted publisher before enabling it. It verifies the exact requested 0.x version and repository metadata, runs the package gate, and executes:

```sh
npm publish .local/pack/svelte-imageway-0.1.0.tgz --tag next --access public --provenance
```

That command is for the supported CI/OIDC environment, not a promise of provenance on an arbitrary local shell. Check the registry and GitHub release before announcing publication; an uploaded GitHub repository does not imply that npm publication succeeded. Paid cloud deployment is outside this package release. Initial-package dist-tag behavior must be checked after publication; do not advertise 1.0/latest accidentally. Verify the registry tar integrity, metadata, dist-tags and provenance before announcing the preview.

A later 1.0 workflow must require the original 1,536-byte size acceptance, measured build parity, the exact browser target, codec requirements and real deployment/CI evidence. The current release workflow intentionally accepts only 0.x versions.

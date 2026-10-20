# Release policy and commands

This checkout prepares 0.1.0 for `next`; nothing has been published. 1.0 is blocked by the documented size/build/Lighthouse targets and codec/cloud verification gaps. The preview CI enforces a 3,400-byte full Image gzip regression budget; `bun run check:acceptance-size` enforces the original 1,536-byte target and currently fails. Do not describe the preview budget as meeting the original target.

## Configure real identity

No public Git remote, npm owner or funding URL has been assumed. Before publishing, create/select the actual public repository and configure its metadata:

```sh
IMAGEWAY_REPOSITORY=https://github.com/ACTUAL_OWNER/ACTUAL_REPOSITORY bun run release:metadata
# Optional: also set IMAGEWAY_FUNDING to a real HTTPS funding page.
```

The uppercase owner/repository tokens are placeholders, not a repository created by this task. Review/commit package.json. Funding is omitted if no real destination exists. Set a private conduct/security contact before opening the public community. Ensure the npm package name is still available and that the publishing account is authorized; the earlier availability check did not reserve it.

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

That command is for the supported CI/OIDC environment, not a promise of provenance on an arbitrary local shell. No npm login, publication, Git push or paid cloud deployment was executed in this task. Initial-package dist-tag behavior must be checked after publication; do not advertise 1.0/latest accidentally. Verify the registry tar integrity, metadata, dist-tags and provenance before announcing the preview.

A later 1.0 workflow must require the original 1,536-byte size acceptance, measured build parity, the exact browser target, codec requirements and real deployment/CI evidence. The current release workflow intentionally accepts only 0.x versions.

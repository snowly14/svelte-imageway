# Changesets

Run `bun run changeset` for a user-visible package change. Describe the behavior and choose patch/minor/major. Run `bun run version:packages` to consume changesets and update package versions/changelogs, then `bun install` to update the workspace lock. Review and commit the result before release.

The initial 0.1.0 preview is already versioned and has a baseline changelog. Do not add a fake patch changeset solely to publish 0.1.0. It uses the next dist-tag. 1.0.0 requires the outstanding acceptance issues to close.

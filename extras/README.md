# Deferred documentation website

At the user’s request (20 October 2026), the documentation website is preserved in `docs-preview/` and excluded from the active Bun workspaces, package build and checks. Its preview server on port 4180 has been stopped. Nothing was published.

The draft previously passed its static build and Svelte diagnostics. Visual/browser QA was not completed. Generated content may be stale; the package README is the active entry point.

`docs-preview-maintenance/` retains the generator and unfinished smoke script. Reactivation requires explicitly restoring a workspace entry (or installing the draft’s local dependencies), regenerating content from the repository root, and rerunning build/browser checks. Existing local build artifacts are retained, not part of the npm package.

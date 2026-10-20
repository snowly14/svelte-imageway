# ISSUE-0001: full Image entry exceeds the requested 1.5 KiB gzip budget

Status: open; release acceptance blocker for the original 1.0 definition.

Reproduction: `bun scripts/bundle-budget.ts`. The Svelte peer runtime is externalized; all Imageway helpers reachable from Image.svelte are included. Current measurement: 3,001 gzip bytes at level 9, against a 1,536-byte target. Do not substitute a source-file-only count or externalize our own helpers to make the result look green.

The full entry includes provider resolution, headless sizing/style normalization, native attributes, art direction, preload, context, snippets, cached-image state and transitions. Functional tests pass; this size target does not. Investigate splitting optional provider resolution from the default local-asset path and reducing generated component code, then remeasure in the same protocol. The final release report must retain the failure until the actual entry meets the budget.

# ADR 0014: Capability-driven hybrid delivery (1.2.0)

The user requested smarter image delivery and version 1.2.0. Local imports remain ahead-of-time assets: they need neither an optimizer server nor runtime Sharp. Dynamic URLs use an explicitly configured provider. Providers may advertise `autoFormat` only when their endpoint negotiates Accept and separates cached representations. The existing Node/Kit and Edge services meet that contract. No endpoint is silently installed and no arbitrary remote origin is enabled.

`formatStrategy` defaults to `auto`. Imported artifacts keep explicit sources. Supported dynamic providers omit explicit format sources and request auto; other providers retain their previous behavior. `picture` forces explicit sources. A configured format allowlist also keeps explicit sources, so its restrictions are not discarded. A component with no format/custom sources renders a native img. Signed URLs and endpoint policies still apply.

Automatic build widths remove the penultimate bucket while its ratio to the largest is below 1.25, retaining at least the smallest and largest. Explicit width requests stay exact. This is deterministic resource pruning, not a perceptual quality heuristic. On a 1676px source the default ladder changes from eight to seven widths, or 24 to 21 variants with three formats. Original files and quality defaults are unchanged.

Type generation now includes the baseline declaration reference even when no query imports exist yet; `typegen` can run before application checks without starting Vite. Query types describe ImageArtifact, not any. Build resolution checks file existence. This does not claim every possible runtime input is statically validated.

The requested version supersedes the previous preview-only publication restriction. It does not establish that the original 1.5 KiB, build parity, exact Lighthouse 100, or all codec/cloud acceptance targets have passed. Keep those limits visible. Release requires the same CI matrix, browser checks, package validation and provenance as before, publishing the exact reviewed version under latest.

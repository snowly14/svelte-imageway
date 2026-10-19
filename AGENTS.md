# Working agreements

- Use Bun for all dependency installation and workspace scripts: `bun install`, `bun run <script>`.
- `npm view` is permitted for the registry research explicitly requested in the brief. Do not use npm, pnpm, or Yarn as a package manager.
- The authoritative feature request is [the original brief](docs/planning/original-brief.md). The user's Bun instruction supersedes its pnpm workspace requirement.
- Phase 0 is documentation and research only. Do not create implementation files until the user approves M1.
- The brief requires: “Ne passe au suivant qu'après mon feu vert.” Stop at each milestone with concrete results and request approval for the next one.
- Decisions belong in ADRs. Public API documentation and code comments are English. Svelte components must use Svelte 5 runes and snippets.
- Never report a build, benchmark, deployment, or test as passed unless executed. Mark unavailable infrastructure as unverified, not passed.
- Enforce SSRF, filesystem, decoding, and resource limits from the first relevant implementation milestone; M9 is an independent security verification gate.
- Keep Node, filesystem, Sharp, signing secrets, and credentials out of all browser entry points.
- The user requested no sleep until the project is finished and Mac shutdown after final completion. Read the ignored `.local/power-state.md` before touching power controls. Do not shut down at an intermediate milestone. Remove the project's sleep assertion on cancellation or final completion.

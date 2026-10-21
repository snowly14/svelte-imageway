# CLI

Use `bun x svelte-imageway --help` (or `npx svelte-imageway` after publication). Node 22.17+ and Bun are supported. Output is plain text, respects `NO_COLOR` without ANSI escapes, and contains no telemetry. `--json` produces JSON; audit findings exit 1, command/configuration errors exit 2, success exits 0.

- `init [dir] [--dry-run]`: requires an existing Svelte/Vite project. Adds the plugin to a single literal `plugins: [...]` array using the TypeScript parser, preserving comments and other options. Computed/multi-config arrays require manual integration. Adds ambient types and a complete local SVG example without overwriting existing files. A second run is idempotent. Review the diff and run the host build.
- `optimize [dir] [--output dir] [--width 1920] [--quality 75] [--format webp] [--dry-run] [--watch]`: bounded Sharp worker pipeline, writes hashed variants and a JSON report; originals are preserved. Animation is explicitly flattened for this batch command. Runtime limits and codec availability apply. Dry-run reports source sizes without decoding/writing; it is not proof an image will decode. Width/quality follow the runtime ladder. Watch uses the Node filesystem watcher, debounces events and skips generated output/cache. Re-run a clean batch after missed operating-system watcher events.
- `audit [dir] [--json]`: parses Svelte and scans Markdown/CSS/large source files. Reports missing alt/dimensions/loading, likely first-image LCP review, legacy formats, heavy images and unoptimized backgrounds. Dynamic spreads and LCP identification are review hints, not browser measurements. Explicit decorative `alt=""` is valid; Markdown empty alt requires human review.
- `deploy cloudflare|docker [--output dir] [--dry-run]`: generates standalone configuration and instructions only. Never logs in, creates buckets, enables billing or executes deployment. Review names, binding availability, secret variables and costs first. Existing files are preserved. Docker template references 0.1.0: before publication, substitute the locally packed artifact. Cloudflare `LOCAL_OFFLINE=false` is production mode; use true only for the local basic-transform emulator. Sources default private.
- `purge --endpoint https://your-worker/purge --key images/a.png --yes` (or one `--prefix`/`--tag`): token from `IMAGEWAY_PURGE_TOKEN`, customizable with `--token-env`. No token arguments or redirect following. This command targets Imageway's protected Worker API, not undocumented vendor APIs or Node's image route. Purge may incur new transformation costs.
- `migrate [dir] --from enhanced-img|imagetools [--write]`: preview by default. Writes `.imageway-backup` before mutation; refuses to overwrite a backup. Parses imports/Svelte syntax. Converts supported enhanced imports and self-closing static/imported enhanced markup with explicit alt. Unknown directives, dynamic markup and imagetools object consumers need review. `as=picture` imports become typed Imageway artifacts, whose field shape differs; update consumers to `<Image src={artifact}>`. Run `init`, remove the old plugin after reviewing the diff, then build/test. This is a conservative codemod, not a guarantee of arbitrary application migration.

No command deletes source media. Deploy does not reserve infrastructure. Publish/GC are the explicit build APIs documented separately.

Inspect installed native codecs without transforming an image:

```sh
bun x svelte-imageway codecs
bun x svelte-imageway codecs --json
```

The inventory reports native buffer input/output and versions; it does not enable missing codecs. [JPEG XL details](jpeg-xl.md).

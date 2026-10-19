# Versions and compatibility

Checked 2026-10-19. The registry's `latest` tag determines the current stable package selection; beta, next, RC, and development tags are not selected. Metadata compatibility is not execution compatibility.

## Proposed baseline

| Dependency | Stable observed | Selection | Reason |
| --- | --- | --- | --- |
| Svelte | 5.57.2 | 5.57.2 | Svelte 5 only; meets Kit's ^5.57.1 peer |
| SvelteKit | 3.1.0 | 3.1.0 | Current stable; use Kit 3 integration and configuration |
| Vite | 8.3.4 | 8.3.4 | Satisfies Kit ^8.0.12 and Svelte plugin ^8 |
| @sveltejs/vite-plugin-svelte | 7.3.1 | 7.3.1 | Satisfies Kit ^7 |
| @sveltejs/package | 3.0.1 | 3.0.1 | Supported package compilation/declarations; TypeScript ^6 peer |
| sharp | 0.35.5 | 0.35.5 | Node >=20.9; optional server dependency |
| Vitest | 5.0.5 | 5.0.5 | Supports Vite 8; matching coverage/browser packages required |
| @playwright/test | 1.64.1 | 1.64.1 | Stable browser test runner; browser binaries not yet installed |
| Wrangler | 4.151.2 | 4.151.2 | Node >=22; current Worker tooling |
| TypeScript | 7.0.2 | **6.0.3** | Latest stable 7 is outside Kit/package ^6 peer ranges; latest compatible 6 selected |
| SVGO | 4.1.0 | 4.1.0 when needed | SVG optimization; not a security sanitizer |
| thumbhash | 0.1.1 | Optional, evaluated in M2 | Build/server generation only; avoid mandatory browser decoder |
| blurhash | 2.0.5 | Optional, evaluated in M2 | User-requested alternative; same client budget constraint |
| Bun | Installed 1.4.3 | 1.4.3 workspace tool | Required by user; runtime support must be tested independently |

Primary evidence: [npm responses](evidence/npm-view-2026-10-19.json). TypeScript 6.0.3 was additionally checked with `npm view typescript@6.0.3 version engines --json` (Node >=14.17).

## Node LTS

The [official release index](https://nodejs.org/dist/index.json) returned Node **24.22.0** (Krypton LTS, 2026-10-14), **22.23.3** (Jod LTS, 2026-09-23), and 26.12.0 (Current, 2026-10-14). The [release policy](https://nodejs.org/en/about/previous-releases) and [release schedule](https://github.com/nodejs/Release) distinguish Current from LTS. Node 26 must not be described as LTS on this research date.

Choose Node 24.22.0 for development/CI baseline and 22.23.3 for the second LTS lane. A future Node 26 LTS lane can be added after the official transition and verification. Proposed minimum for the Kit integration is Node 22.17, with CI on maintained LTS patches. Do not infer Windows/Linux support from this Mac.

Observed host: Node 26.11.1, npm 11.20.0, Bun 1.4.3. This host's Node is Current and is not the baseline LTS. M1 must arrange an isolated Node 24 runtime without changing the user's global installation.

## Adapter versions

| Official adapter | Stable observed | Declared Kit peer |
| --- | --- | --- |
| static | 4.0.0 | ^3.0.0-next.0 |
| node | 6.0.0 | ^3.0.0-next.0 |
| auto | 8.0.0 | ^3.0.0-next.0 |
| cloudflare | 8.0.1 | ^3.0.0-next.0; Wrangler ^4.118.0 |
| vercel | 7.0.1 | ^3.0.0-next.0 |
| netlify | 7.0.1 | ^3.0.0-next.0 |

Bun and Deno adapters are not assigned invented package names or compatibility claims. Follow the [official adapter index](https://svelte.dev/docs/kit/adapters) and inspect actual adapter packages before implementation.

## Integration changes that affect design

The [Kit 3 migration guide](https://svelte.dev/docs/kit/migrating-to-sveltekit-3) moves configuration into the `sveltekit()` Vite plugin; old `svelte.config.js` examples are unsuitable for a new Kit 3 application. `imageAdapter()` must work with the current adapter interface rather than inspect a legacy config file.

[Vercel's Kit adapter](https://svelte.dev/docs/kit/adapter-vercel) exposes image configuration. Use the [Build Output API](https://vercel.com/docs/build-output-api/v3/configuration#images) rather than pretending `/_vercel/image` works on arbitrary hosting.

The publication plugin should rewrite the URLs of its own emitted artifacts through Vite asset references and a validated public base. Changing global `paths.assets` is not required and could accidentally move unrelated app assets; confirm the final mechanism against [Kit configuration](https://svelte.dev/docs/kit/@sveltejs-kit-vite) and Vite's emitted-asset behavior in M2/M7.

For `sizes="auto"`, [MDN's current element reference](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/img#sizes) restricts it to lazy images and recommends fallback sizes. The default remains explicit sizes until a current browser-compatibility matrix is captured in M3. Offer `auto, 100vw` as a progressive option for lazy images only. Never use auto sizing for an eager priority preload.

## Execution status

Registry requests, official documentation reads, host version checks and power assertions were executed. Dependency installation, Kit compatibility builds, Sharp codec probes, tests, Wrangler, browser tests, Docker, packaging and benchmarks have **not** been executed. Docker is absent from PATH. No pass is inferred from version metadata.

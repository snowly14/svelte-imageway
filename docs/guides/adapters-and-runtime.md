# Adapters and runtime

Wrap the actual adapter object to preserve all official adapter Vite/runtime hooks:

```ts
import node from '@sveltejs/adapter-node';
import { imageAdapter } from 'svelte-imageway/kit';
// Inside sveltekit configuration:
sveltekit({adapter: imageAdapter(node())});
```

`imageAdapter('node'|'static'|'cloudflare'|'vercel'|'netlify')` dynamically imports the selected official adapter (install it first). For adapter-auto, resolve the actual deployment target explicitly rather than guessing from an unknown environment. A supplied Bun/Deno adapter needs an explicit matching target and verified runtime; there is no invented official Bun/Deno adapter package.

Static: generate imports at build time, optionally publish them directly to CDN storage. Dynamic URL strings need a real external provider on static sites. Node/Bun: use the Sharp service with sourceRoot, signing policy and disk cache. Cloudflare/Vercel/Netlify: native providers are the default; local Sharp on an incompatible edge target is rejected with a clear error. Native deployment entitlement and external origin allowlisting remain platform configuration.

```ts
// src/hooks.server.ts
import { imageHandle } from 'svelte-imageway/kit';
export const handle = imageHandle({ sourceRoot: '/approved/images',
  publicSources: false, signingKeys: { current: 'IMAGEWAY_SIGNING_KEY' } });
```

Compose with existing hooks using SvelteKit sequence. The handler only intercepts the configured image route and leaves prerender/streaming SSR resolution intact. It never buffers arbitrary streamed page HTML or mutates transformPageChunk output. Place preload hints before the response is committed; a hook cannot retrofit 103 after streaming starts.

Verified apps: basic Kit, adapter-static, adapter-node, local Wrangler bindings, standalone Node/Bun and Docker. Official Cloudflare/Vercel/Netlify adapter wrappers are constructed/type-checked and their native URLs have conformance tests. Cloud account deployment has not been executed. Deno Deploy and Vercel/Netlify Edge use their native providers; this preview does not ship an unmeasured Sharp/WASM edge runtime.

Cache defaults private. Explicit public mutable originals use 60 seconds plus SWR; verified content-hash URLs may be immutable. Signed public URLs clamp TTL to expiration with must-revalidate. Signatures do not make a mutable source immutable. See the threat model and topology guide before sharing cache across tenants.

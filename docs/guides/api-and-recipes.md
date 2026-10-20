# API reference and integration recipes

## Package entries

- `svelte-imageway`: Image, Picture, BackgroundImage, ImageMeta, ImageConfigProvider, headless/context/types.
- `/props`: getImageProps and imageSizes, no Svelte runtime dependency.
- `/core`: parseRequest, normalizeRequest, imageUrl, canonicalQuery, cacheIdentity, signRequest, verifyRequest, negotiateFormat, mimeType, defineConfig.
- `/config` and `/types`: Node-safe configuration and ambient import declarations.
- `/vite`: imageway plugin, parseDirectives, generateImageTypes.
- `/kit`: imageAdapter, imageStrategy, imageHandle, imagePreloadHandle, createImageService.
- `/node`: Sharp processing/cache/source helpers and actual codec inventory.
- `/edge`: createImageWorker, ImageBudget, cfImageTransform and binding types.
- `/providers/<name>`: independent credential-free factories; custom providers implement name, capabilities, buildUrl and validate.
- `/cms`: recognizeCms, cms, cmsArtifact.
- `/providers/fallback`: required-policy server transport orchestration.
- `/publish` and `/publish/targets`: StorageTarget, publishAssets, manifests, explicit GC and optional SDK factories.
- `/cli`: main() with stable process exit codes; binary also available as svelte-imageway.

Public TypeScript declarations are the exact reference for option shapes. The versioned URL spec has JSON Schema and OpenAPI. Config schema describes serializable fields; executable provider factories and credentialed storage targets belong in typed TypeScript configuration, not JSON.

## Custom provider

```ts
const provider = {
  name: 'my-cdn',
  capabilities: {formats:['webp','jpeg'],fit:['inside'],smartCrop:false,animation:false,signature:false},
  validate() {},
  buildUrl({key,w,q,format}) { return `https://images.example/${encodeURIComponent(key!)}?w=${w}&q=${q}&format=${format}`; }
};
```

Use a custom object explicitly in a subtree/component or `generic({template,capabilities})` for central Vite serialization. The custom provider is responsible for rejecting unsupported transforms and enforcing its own remote account policy. Do not put secrets into the factory.

## Ecosystem recipes

Tailwind: pass class attributes normally and retain aspect-ratio/dimension layout. Storybook/Vitest browser: include imageway() in that Vite instance. Standalone Svelte needs imageway() for the public virtual config. Vitest pure headless code can import /props without the virtual module.

mdsvex/Markdown: use a Svelte Image component with a typed imported artifact, or a renderer that supplies explicit dimensions. No automatic raw img preprocessor is shipped. The CLI audit helps identify Markdown images needing review.

PWA: cache public content-hashed build variants with an immutable asset strategy. Do not precache signed/private URLs or strip query authorization fields. Purge old service-worker versions before garbage-collecting objects referenced by them. Browser storage quota and offline consent are application concerns.

Sitemap: list absolute public original/canonical image URLs with application page ownership and rights metadata. Imageway does not infer a complete image sitemap from component runtime state. Video conversion, image sitemap generation, automatic overlay, avatar/grid helpers and Storybook package distribution remain planned bonuses, not shipped APIs.

# Remote images and CMS

```svelte
<script lang="ts">
  import { Image } from 'svelte-imageway';
</script>
<Image src="photos/trail.jpg" width={1200} height={800} alt="A mountain trail" />
```

Select the public provider in central Vite config; the component stays the same. `providers: { 'images.example.com': providerA, '*': providerB }` selects by exact source hostname. An explicit `provider` prop or ImageConfigProvider subtree overrides the central choice. Only the supported capability intersection is portable: advanced native transforms may be unavailable, and fail explicitly. Remote intrinsic dimensions are supplied by the application/CMS; the browser is not sent a Sharp metadata probe.

Use `cms({kind,base})` from `svelte-imageway/cms` or the CMS provider subpath. `recognizeCms(url)` recognizes exact public Sanity, Contentful, Storyblok, Prismic, DatoCMS, Shopify and Unsplash hosts. Directus needs an explicit hint/base because it is self-hosted. Preserve Unsplash attribution and fulfill the upstream API's attribution obligations. Signed third-party query URLs are not freely editable: regenerate them with the vendor server signer.

Strapi and WordPress return pre-generated variants. Map each variant to `{url,width,height,mime}` and call `cmsArtifact(original, variants, origin)`. WordPress `source_url` maps to `url`; Strapi `formats` entries already contain dimensions. There is no fictitious `?w=` API for arbitrary CMS installs.

For the local Node service, remote sources require an exact HTTPS origin allowlist and DNS-pinned fetch. Private IPs, metadata endpoints, redirects outside policy, oversized sources and traversal fail closed. Worker mode uses approved R2 keys instead of a remote proxy. An HMAC signature is required for arbitrary transformations; never put signing secrets into frontend props.

`createFallback({providers,transport,original?})` is a server-only circuit breaker. The transport must enforce origin/byte policy. Timeout/network/5xx can advance to a backup; auth, validation and budget failures cannot. Original fallback requires an explicit authorizing callback. No JavaScript retry loop races multiple CDN downloads in the browser.

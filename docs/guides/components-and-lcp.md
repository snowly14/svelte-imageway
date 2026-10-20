# Components, art direction and LCP

`Image` and `Picture` share `src`, required `alt`, native img attributes, dimensions, sizes, priority, loading/decoding/fetchpriority, fit/position, provider, placeholder, class/style, onload/onerror and loading/error snippets. Use `alt=""` explicitly for decorative images. Localized alt is an ordinary translated string. Svelte 5 runes/snippets only.

```svelte
<Picture src={landscape} alt="A valley" priority
  sources={[{type:'image/webp',srcset:portrait.srcset,media:'(max-width: 640px)',width:portrait.width,height:portrait.height}]}
  sizes="sm:100vw md:50vw lg:33vw">
  {#snippet error()}<span>Image unavailable</span>{/snippet}
</Picture>
```

`priority` sets eager/high/sync and one matching preload in svelte:head. The first custom source is the preloaded art-direction source; ensure its media matches the intended LCP viewport. Multiple format preloads would cause unnecessary downloads, so Imageway emits only one. For HTTP Link hints use `imagePreloadHandle`; set ordinary `Link: <...>; rel=preload; as=image` before headers stream. Portable Kit hooks cannot promise HTTP 103 Early Hints; platform support is operator-specific.

Images reserve intrinsic dimensions/aspect-ratio. Use CSS that preserves those dimensions when changing layouts. `sizes="auto, 100vw"` is passed only for lazy images, with explicit fallback for older browsers; eager images use the fallback. Never lazy-load the expected LCP image. Client Hints are not automatically requested: arbitrary Width/DPR/Vary values can explode cache cardinality. Runtime DPR is explicit and bounded; Save-Data lowers quality after authorization and participates in response/cache variation.

Placeholders use inline CSS and remain useful without JS. Reduced motion disables the reveal. A cached/304 image does not restart a fade. Cross-origin timing without Timing-Allow-Origin may omit transfer data; Imageway then keeps the image visible instead of assuming it should animate. `contentVisibility="auto"` and `transitionName="hero-image"` are optional; choose valid stable names and avoid duplicate View Transition names on a page.

`getImageProps` returns native attributes plus `sources` and placeholder; remove nonnative fields before spreading onto img. `BackgroundImage` emits ordinary URL fallback and image-set, with optional media variants. `ImageMeta` emits OG/Twitter/image_src metadata; supply an absolute public origin for relative artifacts. ImageConfigProvider isolates reactive subtree settings, including SSR requests.

The full Image entry currently exceeds the 1.5 KiB gzip target; see the measured bundle report and issue 0001. Headless markup avoids component state when an application does not need snippets/transitions.

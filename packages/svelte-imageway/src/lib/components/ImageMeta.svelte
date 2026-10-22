<script lang="ts">
  import { resolveImageArtifact } from '../core/artifact.js';
  import type { ImageArtifact } from '../core/types.js';
  let {
    src,
    width,
    height,
    type,
    alt = '',
    origin,
  }: {
    src: ImageArtifact | string;
    width?: number;
    height?: number;
    type?: string;
    alt?: string;
    origin?: string;
  } = $props();
  const artifact = $derived(resolveImageArtifact(src));
  const url = $derived(
    origin
      ? new URL(artifact?.src ?? (src as string), origin).href
      : (artifact?.src ?? (src as string)),
  );
  const mime = $derived(
    type ??
      `image/${url.match(/\.(avif|webp|png|jpe?g)(?:[?#]|$)/i)?.[1]?.replace('jpg', 'jpeg') ?? 'jpeg'}`,
  );
</script>

<svelte:head>
  <meta property="og:image" content={url} />
  <meta property="og:image:alt" content={alt} />
  {#if width ?? artifact?.width}<meta
      property="og:image:width"
      content={String(width ?? artifact?.width)}
    />{/if}
  {#if height ?? artifact?.height}<meta
      property="og:image:height"
      content={String(height ?? artifact?.height)}
    />{/if}
  <meta property="og:image:type" content={mime} />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content={url} />
  <meta name="twitter:image:alt" content={alt} />
  <link rel="image_src" href={url} />
</svelte:head>

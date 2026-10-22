<script lang="ts">
  import { imageRepresentation, resolveImageArtifact } from '../core/artifact.js';
  import { invariant } from '../core/errors.js';
  import type { StaticImageProps as Props } from '../static-props.js';
  let {
    src,
    alt,
    priority = false,
    placeholder = true,
    sizes = '100vw',
    style = '',
    onload,
    loading,
    decoding,
    fetchpriority,
    ...rest
  }: Props = $props();
  let element: HTMLImageElement;
  let loaded = $state(false);
  const artifact = $derived.by(() => {
    const value = resolveImageArtifact(src);
    invariant(
      value,
      'STATIC_IMPORT_REQUIRED',
      'StaticImage requires an imported local image or an ImageArtifact; use Image for dynamic URLs.',
    );
    return value;
  });
  const preview = $derived(
    placeholder &&
      /^data:image\/(?:webp|png|jpeg);base64,[a-zA-Z0-9+/]+=*$/.test(artifact.placeholder ?? '')
      ? artifact.placeholder
      : undefined,
  );
  const color = $derived(
    placeholder && /^#[a-f\d]{6,8}$/i.test(artifact.dominantColor ?? '')
      ? artifact.dominantColor
      : 'transparent',
  );
  const image = $derived(imageRepresentation(artifact));
  $effect(() => {
    void src;
    loaded = element?.complete && element.naturalWidth > 0;
  });
</script>

<svelte:head>
  {#if priority}
    <link
      rel="preload"
      as="image"
      href={image.src}
      imagesrcset={image.srcset}
      imagesizes={sizes}
      type={image.type}
      fetchpriority="high"
    />
  {/if}
</svelte:head>
<img
  {...rest}
  bind:this={element}
  src={image.src}
  srcset={image.srcset}
  width={image.width}
  height={image.height}
  {alt}
  {sizes}
  loading={priority ? 'eager' : (loading ?? 'lazy')}
  decoding={decoding ?? 'async'}
  fetchpriority={priority ? 'high' : fetchpriority}
  style={`max-width:100%;height:auto;${!loaded && placeholder ? `background-color:${color};${preview ? `background-image:url("${preview}");background-size:cover;` : ''}` : ''}${style ?? ''}`}
  onload={(event) => {
    loaded = true;
    onload?.call(element, event);
  }}
/>

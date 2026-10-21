<script lang="ts">
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
  const preview = $derived(
    placeholder &&
      /^data:image\/(?:webp|png|jpeg);base64,[a-zA-Z0-9+/]+=*$/.test(src.placeholder ?? '')
      ? src.placeholder
      : undefined,
  );
  const color = $derived(
    placeholder && /^#[a-f\d]{6,8}$/i.test(src.dominantColor ?? '')
      ? src.dominantColor
      : 'transparent',
  );
  const first = $derived(src.sources[0]);
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
      href={first ? undefined : src.src}
      imagesrcset={first?.srcset ?? src.srcset}
      imagesizes={sizes}
      type={first?.type}
      media={first?.media}
      fetchpriority="high"
    />
  {/if}
</svelte:head>
<picture>
  {#each src.sources as source, index (index)}
    <source
      type={source.type}
      srcset={source.srcset}
      media={source.media}
      {sizes}
      width={source.width}
      height={source.height}
    />
  {/each}
  <img
    {...rest}
    bind:this={element}
    src={src.src}
    srcset={src.srcset}
    width={src.width}
    height={src.height}
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
</picture>

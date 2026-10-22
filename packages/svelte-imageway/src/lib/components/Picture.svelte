<script lang="ts">
  import { getImageProps } from '../props.js';
  import { getImageConfig } from '../context.js';
  import ImageElement from './ImageElement.svelte';
  import type { Snippet } from 'svelte';
  import type { PictureProps as Props } from '../component-types.js';
  let {
    src,
    alt,
    priority = false,
    sources: customSources,
    source,
    formatStrategy,
    loading: loadingProp,
    error,
    loadingContent,
    errorContent,
    onload,
    onerror,
    ...rest
  }: Props = $props();
  const config = getImageConfig();
  const image = $derived.by(() => {
    void formatStrategy;
    return getImageProps({
      ...rest,
      src,
      alt,
      priority,
      config,
      formatStrategy: 'picture',
      loading: typeof loadingProp === 'string' ? loadingProp : undefined,
    });
  });
  const attributes = $derived.by(() => {
    const { sources, placeholder, ...native } = image;
    void sources;
    void placeholder;
    return native;
  });
  const loadingSnippet = $derived(
    loadingContent ?? (typeof loadingProp === 'function' ? loadingProp : undefined),
  );
  const sources = $derived(customSources ?? image.sources);
  const preload = $derived(sources[0]);
</script>

<svelte:head>
  {#if priority && !source}
    <link
      rel="preload"
      as="image"
      href={preload ? undefined : attributes.src}
      imagesrcset={preload?.srcset ?? attributes.srcset}
      imagesizes={attributes.sizes}
      type={preload?.type}
      media={preload?.media}
      fetchpriority="high"
    />
  {/if}
</svelte:head>
{#snippet pictureElement(img: Snippet)}
  <picture>
    {#each sources as item, index (index)}
      <source
        srcset={item.srcset}
        type={item.type}
        media={item.media}
        sizes={attributes.sizes}
        width={item.width}
        height={item.height}
      />
    {/each}
    {@render source?.()}
    {@render img()}
  </picture>
{/snippet}
<ImageElement
  wrapper={pictureElement}
  {attributes}
  {onload}
  {onerror}
  loading={loadingSnippet}
  error={errorContent ?? error}
/>

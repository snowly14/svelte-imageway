<script lang="ts">
  import { getImageProps } from '../props.js';
  import { getImageConfig } from '../context.js';
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
  const sources = $derived(customSources ?? image.sources);
  const preload = $derived(sources[0]);
  let element: HTMLImageElement;
  let loaded = $state(false);
  let failed = $state(false);
  let animate = $state(false);
  $effect(() => {
    void attributes.src;
    void attributes.srcset;
    loaded = element?.complete && element.naturalWidth > 0;
    failed = false;
    animate = false;
  });
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
  <img
    {...attributes}
    bind:this={element}
    class:ready={loaded}
    class:fade={animate}
    onload={(event) => {
      const timing = performance.getEntriesByName(element.currentSrc).at(-1) as
        PerformanceResourceTiming | undefined;
      animate = !loaded && (timing?.transferSize ?? 0) > 300;
      loaded = true;
      failed = false;
      onload?.call(element, event);
    }}
    onerror={(event) => {
      failed = true;
      onerror?.call(element, event);
    }}
  />
</picture>
{#if failed}{@render (errorContent ?? error)?.()}{:else if !loaded}{@render (
    loadingContent ?? (typeof loadingProp === 'function' ? loadingProp : undefined)
  )?.()}{/if}

<style>
  img {
    transition: background-color 180ms ease;
  }
  img.ready {
    background-image: none !important;
    background-color: transparent !important;
  }
  img.fade {
    animation: imageway-reveal 180ms ease;
  }
  @keyframes imageway-reveal {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    img,
    img.fade {
      transition: none;
      animation: none;
    }
  }
</style>

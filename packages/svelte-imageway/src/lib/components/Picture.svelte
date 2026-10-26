<script lang="ts">
  import { getImageProps } from '../props.js';
  import { getImageConfig } from '../context.js';
  import type { PictureProps as Props } from '../component-types.js';
  let props: Props = $props();
  const config = getImageConfig();
  const image = $derived.by(() => {
    return getImageProps({
      ...props,
      config,
      formatStrategy: 'picture',
      loading: typeof props.loading === 'string' ? props.loading : undefined,
    });
  });
  const attributes = $derived.by(() => {
    const { sources, placeholder, ...native } = image;
    void sources;
    void placeholder;
    return native;
  });
  const sources = $derived(props.sources ?? image.sources);
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
  {#if props.priority && !props.source}
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
  {@render props.source?.()}
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
      props.onload?.call(element, event);
    }}
    onerror={(event) => {
      failed = true;
      props.onerror?.call(element, event);
    }}
  />
</picture>
{@render (failed
  ? (props.errorContent ?? props.error)
  : !loaded
    ? (props.loadingContent ?? (typeof props.loading === 'function' ? props.loading : undefined))
    : undefined)?.()}

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

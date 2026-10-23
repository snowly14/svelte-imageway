<script lang="ts">
  import { getImageProps } from '../props.js';
  import { getImageConfig } from '../context.js';
  import type { ImageProps as Props } from '../component-types.js';
  import { invariant } from '../core/errors.js';
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
  const attributes = $derived.by(() => {
    invariant(
      customSources === undefined && source === undefined && formatStrategy === undefined,
      'PICTURE_REQUIRED',
      'Use Picture for sources, source snippets or picture format strategy.',
    );
    const { sources, placeholder, ...native } = getImageProps({
      ...rest,
      src,
      alt,
      priority,
      config,
      formatStrategy: 'img',
      loading: typeof loadingProp === 'string' ? loadingProp : undefined,
    });
    void sources;
    void placeholder;
    return native;
  });
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
  {#if priority}
    <link
      rel="preload"
      as="image"
      href={attributes.src}
      imagesrcset={attributes.srcset}
      imagesizes={attributes.sizes}
      fetchpriority="high"
    />
  {/if}
</svelte:head>
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

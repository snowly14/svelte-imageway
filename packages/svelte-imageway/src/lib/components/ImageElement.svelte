<script lang="ts">
  import type { HTMLImgAttributes } from 'svelte/elements';
  import type { Snippet } from 'svelte';
  let {
    attributes,
    onload,
    onerror,
    loading,
    error,
    wrapper,
  }: {
    attributes: HTMLImgAttributes;
    onload?: HTMLImgAttributes['onload'];
    onerror?: HTMLImgAttributes['onerror'];
    loading?: Snippet;
    error?: Snippet;
    wrapper?: Snippet<[Snippet]>;
  } = $props();
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

{#snippet imageElement()}
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
{/snippet}
{#if wrapper}{@render wrapper(imageElement)}{:else}{@render imageElement()}{/if}
{#if failed}{@render error?.()}{:else if !loaded}{@render loading?.()}{/if}

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
    img {
      transition: none;
      animation: none;
    }
  }
</style>

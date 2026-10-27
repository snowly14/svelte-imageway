<script lang="ts">
  import '../image.css';
  import { getImageProps } from '../props.js';
  import { getImageConfig } from '../context.js';
  import type { ImageProps as Props } from '../component-types.js';
  import { invariant } from '../core/errors.js';
  let {
    sources,
    source,
    formatStrategy,
    loading,
    error,
    loadingContent,
    errorContent,
    ...props
  }: Props = $props();
  const config = getImageConfig();
  const attributes = $derived.by(() => {
    invariant(
      sources === undefined && source === undefined && formatStrategy === undefined,
      'PICTURE_REQUIRED',
      'Use Picture for sources, source, or formatStrategy.',
    );
    const {
      sources: unusedSources,
      placeholder,
      ...native
    } = getImageProps({
      ...props,
      config,
      formatStrategy: 'img',
      loading: typeof loading === 'string' ? loading : undefined,
    });
    void unusedSources;
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
  {#if props.priority}
    <link
      rel="preload"
      as="image"
      {...{ href: attributes.src, imagesrcset: attributes.srcset, imagesizes: attributes.sizes }}
      fetchpriority="high"
    />
  {/if}
</svelte:head>
<img
  {...attributes}
  bind:this={element}
  class:imageway-image={true}
  class:ready={loaded}
  class:fade={animate}
  onload={(event) => {
    animate =
      !loaded &&
      ((
        performance.getEntriesByName(element.currentSrc).at(-1) as
          PerformanceResourceTiming | undefined
      )?.transferSize ?? 0) > 300;
    loaded = true;
    failed = false;
    props.onload?.call(element, event);
  }}
  onerror={(event) => {
    failed = true;
    props.onerror?.call(element, event);
  }}
/>
{@render (failed
  ? (errorContent ?? error)
  : !loaded
    ? (loadingContent ?? (typeof loading === 'function' ? loading : undefined))
    : undefined)?.()}

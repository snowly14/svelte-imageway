<script lang="ts">
  import { getImageProps } from '../props.js';
  import { getImageConfig } from '../context.js';
  import ImageElement from './ImageElement.svelte';
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
<ImageElement
  {attributes}
  {onload}
  {onerror}
  loading={loadingContent ?? (typeof loadingProp === 'function' ? loadingProp : undefined)}
  error={errorContent ?? error}
/>

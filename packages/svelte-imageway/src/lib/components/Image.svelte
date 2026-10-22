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
  const image = $derived.by(() => {
    invariant(
      customSources === undefined && source === undefined && formatStrategy === undefined,
      'PICTURE_REQUIRED',
      'Use Picture for sources, source snippets or picture format strategy.',
    );
    return getImageProps({
      ...rest,
      src,
      alt,
      priority,
      config,
      formatStrategy: 'img',
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
  loading={loadingSnippet}
  error={errorContent ?? error}
/>

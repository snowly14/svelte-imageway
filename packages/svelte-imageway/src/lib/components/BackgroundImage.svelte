<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';
  import type { ImageArtifact } from '../core/types.js';
  import { backgroundStyle } from '../background.js';
  let {
    src,
    variants = [],
    children,
    style = '',
    ...rest
  }: Omit<HTMLAttributes<HTMLDivElement>, 'style'> & {
    src: ImageArtifact | string;
    variants?: Array<{ media: string; src: ImageArtifact | string }>;
    children?: Snippet;
    style?: string;
  } = $props();
  const id = $props.id();
  const css = $derived(
    variants
      .filter((v) => /^[\w\s():./-]+$/.test(v.media))
      .map(
        (v) => `@media ${v.media}{[data-imageway-background="${id}"]{${backgroundStyle(v.src)}}}`,
      )
      .join(''),
  );
</script>

<svelte:head>
  <!-- The CSS builder rejects media delimiters and escapes raw-text URL delimiters. -->
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html css ? `<style>${css}</style>` : ''}
</svelte:head>
<div {...rest} data-imageway-background={id} style={`${backgroundStyle(src)};${style}`}>
  {@render children?.()}
</div>

<script lang="ts">
  import type { ImageProps } from '../component-types.js';
  import Image from './Image.svelte';
  let props: ImageProps = $props();
</script>
<Image {...props} />

<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { ImageContextConfig } from '../props.js';
  import { setImageConfig } from '../context.js';
  let { config, children }: { config: ImageContextConfig; children: Snippet } = $props();
  setImageConfig({
    get formatStrategy() {
      return config.formatStrategy;
    },
    get provider() {
      return config.provider;
    },
    get providers() {
      return config.providers;
    },
    get widths() {
      return config.widths;
    },
    get quality() {
      return config.quality;
    },
    get formats() {
      return config.formats;
    },
  });
</script>

{@render children()}

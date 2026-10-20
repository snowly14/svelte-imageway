<script lang="ts">
  import { Image, ImageMeta } from 'svelte-imageway';
  import hero from '../landscape.png?img&w=320;640;960&format=avif;webp;jpg';
</script>

<svelte:head><title>Imageway SvelteKit example</title></svelte:head>
<ImageMeta src={hero} origin="https://example.com" alt="Procedural landscape" />
<main>
  <h1>One import. A responsive image.</h1>
  <Image
    src={hero}
    alt="Procedural mountain landscape"
    priority
    sizes="(min-width: 960px) 960px, 100vw"
  />
</main>

<style>
  :global(body) {
    font-family: system-ui;
    margin: 0;
    background: #f5f8fa;
    color: #173143;
  }
  main {
    max-width: 960px;
    margin: auto;
    padding: 24px;
  }
</style>

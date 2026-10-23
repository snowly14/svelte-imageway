<script lang="ts">
  import { Image, Picture } from 'svelte-imageway';
  import hero from './landscape.png';
  let broken = $state(true);
  let loads = $state(0);
  let correctContext = $state(true);
  function loaded(this: HTMLImageElement, event: Event) {
    correctContext &&= this === event.currentTarget && this.tagName === 'IMG';
    loads++;
  }
  function failed(this: HTMLImageElement, event: Event) {
    correctContext &&= this === event.currentTarget && this.tagName === 'IMG';
  }
</script>

<button onclick={() => (broken = false)}>Use valid lifecycle image</button>
{#each [Image, Picture] as Component, index (Component)}
  <div style="min-height:100px">
    <Component
      src={broken ? '/lifecycle-missing.png' : hero}
      alt={`Lifecycle ${index}`}
      width={160}
      height={100}
      sizes="160px"
      loading="eager"
      onload={loaded}
      onerror={failed}
      data-testid={`life-image-${index}`}
    >
      {#snippet loadingContent()}<span data-testid={`life-loading-${index}`}>Loading</span
        >{/snippet}
      {#snippet errorContent()}<span data-testid={`life-error-${index}`}>Unavailable</span
        >{/snippet}
    </Component>
  </div>
{/each}
<output data-testid="life-loads">{loads}</output>
<output data-testid="life-context">{String(correctContext)}</output>

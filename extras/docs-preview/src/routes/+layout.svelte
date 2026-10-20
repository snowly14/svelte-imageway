<script lang="ts">
  import { resolve } from '$app/paths';
  import '../style.css';
  let { children } = $props();
</script>

<svelte:head><meta name="theme-color" content="#f5f3eb" /></svelte:head>
<a class="skip" href="#main">Skip to content</a>
<header class="topbar">
  <a class="brand" href={resolve('/')} aria-label="Imageway home"
    ><svg viewBox="0 0 40 32" aria-hidden="true"
      ><path
        d="M3 27L16 5L25 21L31 12L38 27"
        fill="none"
        stroke="currentColor"
        stroke-width="3.5"
      /></svg
    >imageway<span class="preview">0.1 preview</span></a
  >
  <nav aria-label="Main navigation">
    <a href={resolve('/docs/[slug]', { slug: 'getting-started' })}>Documentation</a><a
      href={resolve('/playground')}>Playground</a
    ><a href={resolve('/docs/[slug]', { slug: 'topology-and-costs' })}>CDN & costs ↗</a>
  </nav>
</header>
{@render children()}
<footer>
  <div class="brand small">imageway</div>
  <p>A Svelte 5 image toolkit. Built for the route you choose.</p>
  <a href={resolve('/docs/[slug]', { slug: 'security' })}>Security & limits</a><span
    >MIT · Local preview · No tracking</span
  >
</footer>

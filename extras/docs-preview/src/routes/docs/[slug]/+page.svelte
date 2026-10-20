<script lang="ts">
  import { resolve } from '$app/paths';
  import { navigation } from '#lib/navigation.js';
  let { data } = $props();
  let search = $state('');
  const filtered = $derived(
    navigation.filter((v) => v.title.toLowerCase().includes(search.toLowerCase())),
  );
</script>

<svelte:head
  ><title>{data.article.title} — Imageway</title><meta
    name="description"
    content={`${data.article.title}: Imageway Svelte 5 documentation, practical guidance and verified limits.`}
  /></svelte:head
>
<main id="main" class="docs-layout">
  <aside class="docs-sidebar">
    <label for="doc-search">Find a guide</label><input
      id="doc-search"
      type="search"
      bind:value={search}
      placeholder="Search guide titles"
    />
    <nav aria-label="Documentation">
      {#each filtered as item (item.slug)}<a
          class:active={item.slug === data.article.slug}
          href={resolve('/docs/[slug]', { slug: item.slug })}>{item.title}</a
        >{/each}
    </nav>
  </aside>
  <article class="article">
    <p class="eyebrow">IMAGEWAY / DOCUMENTATION</p>
    <h1>{data.article.title}</h1>
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- Generated only from trusted repository Markdown. -->
    {@html data.article.html}
    <div class="article-end">
      <a href={resolve('/playground')}>Try the playground →</a><a
        href={resolve('/docs/[slug]', { slug: 'getting-started' })}>Getting started ↗</a
      >
    </div>
  </article>
</main>

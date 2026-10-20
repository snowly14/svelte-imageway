<script lang="ts">
  import { resolve } from '$app/paths';
  import { Image } from 'svelte-imageway';
  import hero from '../lib/landscape.png?img&w=480;800;1200&format=avif;webp;jpg';
  const example =
    '<script>\n  import { Image } from "svelte-imageway";\n  import hero from "./hero.jpg?img";\n<' +
    '/script>\n\n<Image src={hero} alt="A mountain trail" priority />';
</script>

<svelte:head
  ><title>Imageway — One image model for Svelte</title><meta
    name="description"
    content="Responsive local images, native providers and a self-hosted image service for Svelte 5. Explore the 0.1 preview and measured limits."
  /></svelte:head
>
<main id="main">
  <section class="hero">
    <div class="hero-copy">
      <p class="eyebrow">SVELTE 5 / SVELTEKIT 3</p>
      <h1>Every image.<br /><span>One way through.</span></h1>
      <p class="lead">
        From a local file to a global delivery layer. Responsive images, native providers and your
        own image service, through one Svelte API.
      </p>
      <div class="actions">
        <a class="button" href={resolve('/docs/[slug]', { slug: 'getting-started' })}
          >Start with an image <span>↗</span></a
        ><a class="quiet" href={resolve('/playground')}>Explore the playground →</a>
      </div>
      <p class="aside">Open source · MIT · 0.1 preview</p>
    </div>
    <figure class="hero-image">
      <Image
        src={hero}
        alt="Illustrated layered mountains below a warm sky"
        priority
        sizes="(min-width: 1000px) 48vw, 100vw"
      />
      <div class="image-stamp">Less work.<br />Better images.</div>
      <figcaption>
        <span>landscape.png → responsive artifact</span><span>AVIF / WebP / JPEG</span>
      </figcaption>
    </figure>
  </section>
  <section class="proof" aria-label="Project principles">
    <div><strong>3 delivery layers</strong><span>Build · provider · image origin</span></div>
    <div><strong>Native HTML</strong><span>srcset, sizes and intrinsic dimensions</span></div>
    <div><strong>Visible limits</strong><span>Measured results, explicit capabilities</span></div>
  </section>
  <section class="getting">
    <div>
      <p class="eyebrow">A SMALL START</p>
      <h2>A file. An import.<br />An image that fits.</h2>
      <p>
        Local imports produce typed variants at build time. The component adds dimensions,
        responsive sources and a matching priority preload.
      </p>
      <a class="text-link" href={resolve('/docs/[slug]', { slug: 'local-images' })}
        >Read the local image guide →</a
      >
    </div>
    <div class="code-window">
      <div class="code-label"><span>+page.svelte</span><span>SVELTE</span></div>
      <pre><code>{example}</code></pre>
    </div>
  </section>
  <section class="delivery">
    <div class="section-heading">
      <p class="eyebrow">CHOOSE YOUR ROUTE</p>
      <h2>Delivery belongs<br />in your configuration.</h2>
      <p>
        Start with a local build. Add a provider or deploy an origin when your application needs it.
        A CDN is supplied by your chosen platform.
      </p>
    </div>
    <div class="routes">
      <a href={resolve('/docs/[slug]', { slug: 'local-images' })}
        ><span class="route-number">01</span>
        <div>
          <h3>At build time</h3>
          <p>Generate content-hashed variants. Ship a static site with direct asset URLs.</p>
        </div>
        <span>↗</span></a
      ><a href={resolve('/docs/[slug]', { slug: 'remote-and-cms' })}
        ><span class="route-number">02</span>
        <div>
          <h3>Through a provider</h3>
          <p>Translate one request model to a native image service or CMS.</p>
        </div>
        <span>↗</span></a
      ><a href={resolve('/docs/[slug]', { slug: 'adapters-and-runtime' })}
        ><span class="route-number">03</span>
        <div>
          <h3>On your own origin</h3>
          <p>Run a bounded Worker or Sharp service behind a real CDN.</p>
        </div>
        <span>↗</span></a
      >
    </div>
  </section>
  <section class="release-note">
    <p class="eyebrow">PREVIEW, WITH EVIDENCE</p>
    <h2>Know what you're adopting.</h2>
    <p>
      The preview includes verified local builds, browser tests, Worker bindings and Docker. Bundle
      size and benchmark parity remain release acceptance targets. Cloud account deployment is a
      separate staging check.
    </p>
    <a class="text-link" href={resolve('/docs/[slug]', { slug: 'faq-and-migration' })}
      >Read compatibility and known limits →</a
    >
  </section>
</main>

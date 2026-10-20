<script lang="ts">
  import { resolve } from '$app/paths';
  import { Image } from 'svelte-imageway';
  import full from '#lib/landscape.png?img&w=320;640;960&format=avif;webp;jpg&q=75';
  import light from '#lib/landscape.png?img&w=320;640;960&format=avif;webp;jpg&q=50';
  import { cloudinary } from 'svelte-imageway/providers/cloudinary';
  import { edge } from 'svelte-imageway/providers/edge';
  import { local } from 'svelte-imageway/providers/local';
  let quality = $state('75'),
    format = $state('all'),
    priority = $state(false),
    route = $state<'local' | 'edge' | 'cloudinary'>('local');
  const artifact = $derived(quality === '50' ? light : full);
  const sources = $derived(
    format === 'all'
      ? artifact.sources
      : artifact.sources.filter((v) => v.type === `image/${format}`),
  );
  const url = $derived(
    (
      {
        local: local(),
        edge: edge({ base: 'https://images.example.com' }),
        cloudinary: cloudinary({ cloudName: 'demo' }),
      }[route] ?? local()
    ).buildUrl({ key: 'landscape.png', w: 640, format: 'webp' }),
  );
</script>

<svelte:head
  ><title>Image playground — Imageway</title><meta
    name="description"
    content="Explore actual prebuilt image variants and preview provider URLs without sending remote transformation requests."
  /></svelte:head
>
<main id="main" class="playground">
  <p class="eyebrow">EXPLORE THE ARTIFACT</p>
  <h1>See the image.<br /><span>Inspect the choices.</span></h1>
  <p class="lead">
    These controls switch real prebuilt variants. Your browser chooses an appropriate source for its
    viewport and format support.
  </p>
  <div class="play-grid">
    <div class="play-image">
      <Image
        src={artifact}
        {sources}
        alt="Layered mountain illustration"
        {priority}
        sizes="(min-width: 900px) 60vw, 100vw"
        data-testid="playground-image"
      />
    </div>
    <form onsubmit={(e) => e.preventDefault()} class="controls">
      <label
        >Quality<select bind:value={quality}
          ><option value="75">75 · standard</option><option value="50">50 · smaller</option></select
        ></label
      ><label
        >Preferred source<select bind:value={format}
          ><option value="all">Automatic picture sources</option><option value="avif"
            >AVIF source</option
          ><option value="webp">WebP source</option><option value="jpeg">JPEG fallback</option
          ></select
        ></label
      ><label class="check"
        ><input type="checkbox" bind:checked={priority} /> Priority preload</label
      >
      <dl>
        <div>
          <dt>Intrinsic size</dt>
          <dd>{artifact.width} × {artifact.height}</dd>
        </div>
        <div>
          <dt>Aspect ratio</dt>
          <dd>{artifact.aspectRatio.toFixed(2)}</dd>
        </div>
        <div>
          <dt>Loading</dt>
          <dd>{priority ? 'eager / high' : 'lazy / auto'}</dd>
        </div>
      </dl>
      <p class="aside">
        Quality settings are codec-specific. This example is an original synthetic fixture, not a
        representative photo corpus.
      </p>
    </form>
  </div>
  <section class="url-preview">
    <h2>Same request, different route.</h2>
    <p>Preview URL translation here. These controls do not send requests to remote accounts.</p>
    <label
      >Provider<select bind:value={route}
        ><option value="local">Local service</option><option value="edge">Imageway Worker</option
        ><option value="cloudinary">Cloudinary</option></select
      ></label
    >
    <pre data-testid="provider-url">{url}</pre>
    <a href={resolve('/docs/[slug]', { slug: 'remote-and-cms' })}>Connect your own provider →</a>
  </section>
</main>

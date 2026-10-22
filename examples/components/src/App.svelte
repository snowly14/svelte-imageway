<script lang="ts">
  import { Image, Picture, BackgroundImage, ImageMeta } from 'svelte-imageway';
  import hero from './landscape.png';
  import directed from './landscape.png?w=320;640;960&format=avif;webp;png&img';
  let events = $state(0);
</script>

<ImageMeta src={hero} origin="https://example.com" alt="Procedural landscape" />
<main>
  <h1>Imageway component verification</h1>
  <Image
    src={hero}
    alt="Procedural mountain landscape"
    priority
    sizes="(min-width: 960px) 960px, 100vw"
    style="width:100%;max-width:960px"
    onload={() => events++}
    data-testid="hero"
  />
  <p data-testid="events">Loads: {events}</p>
  <Image
    src={hero}
    alt="Local landscape"
    sizes="320px"
    style="width:320px"
    data-testid="local-image"
  />
  <Picture
    src={hero}
    alt="Landscape with art direction"
    sources={[
      {
        type: 'image/webp',
        media: '(min-width: 640px)',
        srcset: directed.sources.find((v) => v.type === 'image/webp')!.srcset,
        width: 960,
        height: 640,
      },
    ]}
    data-testid="picture"
  />
  <Picture src={hero} alt="Picture landscape" sizes="320px" data-testid="local-picture" />
  <Image
    src="/missing-image.jpg"
    width={200}
    height={100}
    alt="Image intentionally unavailable"
    data-testid="broken"
    loading="eager"
  >
    {#snippet errorContent()}<p role="status">Image unavailable</p>{/snippet}
  </Image>
  <BackgroundImage
    src={hero}
    style="min-height:180px;background-size:cover;color:white"
    variants={[{ media: '(prefers-color-scheme: dark)', src: hero }]}
    ><p>Decorative responsive background</p></BackgroundImage
  >
  <BackgroundImage
    src="/base.png"
    variants={[{ media: '(min-width: 640px)', src: '/variant.png' }]}
    data-testid="responsive-background"
    style="min-height:1px"
  />
  <div style="height:2000px"></div>
  <Image src={hero} alt="Below-fold landscape" sizes="auto, 100vw" data-testid="lazy" />
</main>

<style>
  :global(body) {
    margin: 0;
    font-family: system-ui, sans-serif;
    background: #f8fafc;
    color: #182632;
  }
  main {
    max-width: 960px;
    margin: auto;
    padding: 24px;
  }
  :global(img) {
    display: block;
  }
</style>

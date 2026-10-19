<script lang="ts">
  import { Image, Picture, BackgroundImage, ImageMeta } from 'svelte-imageway';
  import hero from './landscape.png?img&w=320;640;960&format=avif;webp;png';
  let events = $state(0);
</script>
<ImageMeta src={hero} origin="https://example.com" alt="Procedural landscape" />
<main>
  <h1>Imageway component verification</h1>
  <Image src={hero} alt="Procedural mountain landscape" priority sizes="(min-width: 960px) 960px, 100vw" style="width:100%;max-width:960px" onload={() => events++} data-testid="hero" />
  <p data-testid="events">Loads: {events}</p>
  <Picture src={hero} alt="Landscape with art direction" sources={[{ type: 'image/webp', media: '(min-width: 640px)', srcset: hero.sources.find(v => v.type === 'image/webp')!.srcset, width: 960, height: 640 }]} data-testid="picture" />
  <Image src="/missing-image.jpg" width={200} height={100} alt="Image intentionally unavailable" data-testid="broken" loading="eager">
    {#snippet errorContent()}<p role="status">Image unavailable</p>{/snippet}
  </Image>
  <BackgroundImage src={hero} style="min-height:180px;background-size:cover;color:white" variants={[{ media: '(prefers-color-scheme: dark)', src: hero }]}><p>Decorative responsive background</p></BackgroundImage>
  <div style="height:2000px"></div>
  <Image src={hero} alt="Below-fold landscape" sizes="auto, 100vw" data-testid="lazy" />
</main>
<style>
  :global(body) { margin:0; font-family:system-ui,sans-serif; background:#f8fafc; color:#182632; }
  main { max-width:960px; margin:auto; padding:24px; }
  :global(img) { display:block; }
</style>

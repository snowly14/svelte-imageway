# JPEG XL (.jxl)

JPEG XL supports high-fidelity/lossless images and progressive delivery. It does not guarantee the smallest file for every image. Compare actual images and quality settings. Chrome ships decoding from version 155 ([6 October 2026 announcement](https://developer.chrome.com/blog/jpeg-xl-in-chrome)); Safari supports JPEG XL from version 17 ([WebKit announcement](https://webkit.org/blog/14445/webkit-features-in-safari-17-0/)). Keep a fallback for other clients.

## Inspect this installation

```sh
bun x svelte-imageway codecs
bun x svelte-imageway codecs --json
```

The command reports real native buffer input/output capabilities and codec versions. The standard Sharp 0.35.5 installed in the measured environment reports both JXL flags false. Sharp requires a custom libvips with libjxl and labels JXL encoding experimental ([Sharp documentation](https://sharp.pixelplumbing.com/api-output/#jxl)). Installing this package does not install a JXL encoder.

A recognized JXL input on a decoder-less installation now returns CODEC_UNAVAILABLE (415) with an actionable diagnostic. A custom decoder-enabled installation can supply JXL inputs to the existing raster pipeline, subject to its resource limits. Such a custom build is not verified by the standard binary CI. JXL output is not part of OutputFormat and is not selected automatically; WebP/AVIF/JPEG defaults remain unchanged. No JPEG XL encoding-speed or byte-saving claim is made by this release.

The same report is typed in Node:

```ts
import { codecCapabilities } from 'svelte-imageway/node';

const capabilities = await codecCapabilities();
const canDecodeJxl: boolean = capabilities.formats.jxl.input.buffer;
const canEncodeJxl: boolean = capabilities.formats.jxl.output.buffer;
```

## Serve an existing JPEG XL file

A component can present an already encoded/hosted JXL source, alongside the package's generated fallbacks:

```svelte
<script lang="ts">
  import StaticPicture from 'svelte-imageway/static-picture';
  import type { ImageArtifact } from 'svelte-imageway/core';
  import fallback from './hero.jpg?w=1200&format=webp;jpg&img';

  const hero: ImageArtifact = {
    ...fallback,
    sources: [{ type: 'image/jxl', srcset: '/images/hero-1200.jxl 1200w' }, ...fallback.sources],
  };
</script>

<StaticPicture src={hero} alt="A mountain landscape" sizes="100vw" />
```

Supply the actual hosted file at that URL, encoded from the same image/crop and with the declared width. This example describes existing-file presentation; the import generates the WebP/JPEG fallbacks. A browser that supports image/jxl can select that source, and others can select the fallbacks. Format support alone is not a perceptual-quality benchmark.

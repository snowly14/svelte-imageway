# Getting started

Imageway is a Svelte 5 image toolkit with three delivery layers: build artifacts, native providers and a self-hosted image service. Version 0.1.0 is a local preview; the public npm name has been checked but no release is published yet. Use the packed artifact until the maintainer publishes `next`.

## Three steps

1. Install `bun add svelte-imageway@next` after publication, or `bun add /absolute/path/svelte-imageway-0.1.0.tgz` for this checkout. Sharp is an optional native dependency: local imports need a supported Sharp build; managed providers do not.
2. Add `imageway()` before `sveltekit()` in `vite.config.ts`:

```ts
import { imageway } from 'svelte-imageway/vite';
// preserve your existing adapter and other plugins
export default defineConfig({ plugins: [imageway(), sveltekit()] });
```

3. Import a local artifact and render an image:

```svelte
<script lang="ts">
  import { Image } from 'svelte-imageway';
  import hero from './hero.jpg?img';
</script>
<Image src={hero} alt="A trail through the mountains" priority sizes="100vw" />
```

`bun x svelte-imageway init` can prepare the plugin, ambient types and an example in a literal Vite configuration. No remote provider or account is required for local imports. Build output contains hashed images; use immutable caching on these assets.

## Central configuration

```ts
// svelte-imageway.config.ts
import { defineConfig } from 'svelte-imageway/config';
import { cloudinary } from 'svelte-imageway/providers/cloudinary';
export default defineConfig({ provider: cloudinary({ cloudName: 'your-public-cloud' }),
  widths: [320,640,960,1280,1920], qualities: [50,65,75,85,95], quality: 75 });
```

Import that object into Vite and pass `imageway({config})`. Runtime hooks may import the same object and pass it as `config`; source roots, cache directories, signing environment variable names and publication targets are explicit server/build options. They are excluded from the browser-safe virtual configuration. This package deliberately does not execute an arbitrary config file automatically inside the browser or CLI.

SvelteKit 3 places adapter settings in `sveltekit({adapter})` and TypeScript projects extend `$app/tsconfig`. Preserve the configuration produced by your installed official Svelte CLI. Use `svelte-imageway/config` in Node-loaded configuration; importing the main component entry there would require a Svelte loader.

## Choose a delivery layer

Build-time local imports are the zero-account default. For dynamic URL strings, configure a provider and intrinsic dimensions. For private originals, sign requests on the server and keep public caching disabled. For a static site on a CDN, publish build variants rather than adding runtime transformation.

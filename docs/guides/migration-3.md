# Upgrade to 3.0

Install `bun add svelte-imageway@3.0.0` and keep the existing imageway() Vite plugin. Normal local imports require no query or generated type file.

Replace StaticImage (including the default `/static` import) with the named Image export from svelte-imageway. Replace StaticPicture (`/static-picture`) with Picture. Their obsolete components, props types and subpaths have been removed, without compatibility aliases. Image renders img; Picture renders picture.

```svelte
<script lang="ts">
  import { Image, Picture } from 'svelte-imageway';
  import photo from './photo.jpg';
</script>

<Image src={photo} alt="A mountain trail" />
<Picture src={photo} alt="A mountain trail in multiple formats" />
```

Both accept local imports and provider URLs; optimization is independent of which markup is needed. Keep alt, priority, sizes, class, style and native events. Replace an explicit `placeholder={true}` from a static component by omitting that prop; `placeholder={false}` continues to disable the preview. Picture owns sources and source snippets. Source dimensions remain automatic for imports.

The optional blurhash encoder now uses bundled Rust/WebAssembly during build/server preview generation. Its 4x3 hashes match the reference encoder; no client WASM or Rust installation is required. One-time compilation and preview-only measurements are reported separately. Image codecs and default LQIP behavior are unchanged. Application packaging must retain the installed package's dist/node/blurhash.wasm alongside its server/build files; normal package installation does this automatically.

Developers rebuilding the kernel need Rust 1.99.0 with wasm32-unknown-unknown. Run bun run native:rebuild; CI independently recompiles the artifact and checks exact bytes. Ordinary package builds only verify committed source/artifact hashes and require Bun.

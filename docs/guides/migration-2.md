# Upgrade to 2.0

Historical guide for the 2.x API. Version 3 removes StaticImage/StaticPicture; continue with [the 3.0 migration](migration-3.md).

Version 2.0 changes the markup contract and removes generated image declarations. Upgrade with `bun add svelte-imageway@2.0.0`, keeping `imageway()` before the Svelte plugin.

```svelte
<script lang="ts">
  import { Image } from 'svelte-imageway';
  import photo from './photo.jpg';
</script>

<Image src={photo} alt="A mountain trail" />
```

Use Image by default. Its local import now needs no query, per-image declaration or env file. The value remains a URL string for native img; Image resolves its generated metadata automatically. SVG icons keep Vite behavior. Public-directory paths and dynamic/upload/blob URLs still require a configured runtime provider for optimization.

Image and StaticImage now always render img. Replace Image with Picture, or StaticImage with StaticPicture, when you need multiple format sources, art direction, source snippets or CSS depending on a picture wrapper. Native img uses generated WebP when available, otherwise the configured fallback. Picture preserves format selection through source elements. Existing pre-2.0 artifacts without img metadata use their safe fallback.

Remove sources, source and formatStrategy props from Image; use Picture. ImageConfigProvider's format strategy remains available for headless use, but cannot change the markup of Image/Picture. Only a known first Picture source is preloaded; opaque custom source snippets suppress automatic preload because their selection cannot be inferred.

Delete an Imageway-generated imageway-env.d.ts or imageway.d.ts **after checking it contains no personal declarations**. Remove only the Imageway reference from app.d.ts, preserving the rest. Remove `svelte-imageway typegen` from scripts. Package declarations now supply narrow advanced-import types automatically; they do not declare arbitrary unknown modules as any.

Existing plain `?img` imports still return ImageArtifact. For advanced directive imports, move img to the end: `./photo.jpg?w=640&format=webp&img`. Preview `bun x svelte-imageway migrate ./src --from imageway-v1`; add `--write` to apply with backups. Ordinary imports are the recommended default.

Ordinary imported rasters are processed even when used by native img, so they can increase build work and emitted assets; the original file is emitted too to preserve its URL contract. Use `?url` for deliberate raw imports, or `imageway({autoImports:false})` to retain explicit artifact-only processing. No original is re-encoded in place.

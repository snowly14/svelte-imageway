import type { ImageArtifact, ImageRepresentation } from './types.js';
const registryKey = Symbol.for('svelte-imageway.assets.v2');
interface Registry {
  images: Map<string, ImageArtifact>;
  ids: Map<string, string>;
}
function registry(): Registry {
  const host = globalThis as typeof globalThis & { [registryKey]?: Registry };
  return (host[registryKey] ??= { images: new Map(), ids: new Map() });
}
/** Build-generated registrations only; URLs keep their normal original-file semantics. */
export function registerImageArtifact(url: string, image: ImageArtifact, id = url): void {
  const store = registry();
  const previous = store.ids.get(id);
  store.ids.set(id, url);
  if (previous && previous !== url && ![...store.ids.values()].includes(previous))
    store.images.delete(previous);
  store.images.set(url, image);
}
export function resolveImageArtifact(src: ImageArtifact | string): ImageArtifact | undefined {
  // Reading an unregistered URL must not allocate the HMR registration maps.
  const host = globalThis as typeof globalThis & { [registryKey]?: Registry };
  return typeof src === 'string' ? host[registryKey]?.images.get(src) : src;
}
/** Explicit build-time img representation; never infer codecs from URLs or browser globals. */
export function imageRepresentation(artifact: ImageArtifact): ImageRepresentation {
  return artifact.img ?? artifact;
}

import type { HTMLImgAttributes } from 'svelte/elements';
import type { ImageArtifact } from './core/types.js';
/** Artifact-only native image contract. Dynamic strings/providers use Image. */
export interface StaticImageProps extends Omit<
  HTMLImgAttributes,
  'src' | 'alt' | 'srcset' | 'width' | 'height' | 'placeholder'
> {
  src: ImageArtifact;
  alt: string;
  priority?: boolean;
  placeholder?: boolean;
}

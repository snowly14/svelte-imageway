import type { HTMLImgAttributes } from 'svelte/elements';
import type { ImageArtifact } from './core/types.js';
/** Native image contract for registered local imports or artifacts. Dynamic URLs/providers use Image. */
export interface StaticImageProps extends Omit<
  HTMLImgAttributes,
  'src' | 'alt' | 'srcset' | 'width' | 'height' | 'placeholder'
> {
  src: ImageArtifact | string;
  alt: string;
  priority?: boolean;
  placeholder?: boolean;
}

import type { Snippet } from 'svelte';
import type { ImageOptions } from './props.js';
import type { ImageSource } from './core/types.js';
/** Complete Svelte 5 component props, with explicit snippet/native-loading disambiguation. */
interface SharedImageProps extends Omit<ImageOptions, 'config' | 'loading' | 'formatStrategy'> {
  loading?: ImageOptions['loading'] | Snippet;
  error?: Snippet;
  loadingContent?: Snippet;
  errorContent?: Snippet;
}
/** Always renders img; multi-format and art-direction props belong to Picture. */
export interface ImageProps extends SharedImageProps {
  sources?: never;
  source?: never;
  formatStrategy?: never;
}
/** Always renders picture with an img fallback. */
export interface PictureProps extends SharedImageProps {
  sources?: ImageSource[];
  source?: Snippet;
  formatStrategy?: never;
}

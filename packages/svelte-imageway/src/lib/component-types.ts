import type { Snippet } from 'svelte';
import type { ImageOptions } from './props.js';
import type { ImageSource } from './core/types.js';
/** Complete Svelte 5 component props, with explicit snippet/native-loading disambiguation. */
export interface ImageProps extends Omit<ImageOptions, 'config' | 'loading'> {
  sources?: ImageSource[];
  source?: Snippet;
  loading?: ImageOptions['loading'] | Snippet;
  error?: Snippet;
  loadingContent?: Snippet;
  errorContent?: Snippet;
}

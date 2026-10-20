import { getContext, setContext } from 'svelte';
import { config as publicConfig } from 'virtual:imageway/config';
import type { ImageContextConfig } from './props.js';
const key = Symbol('imageway-context');
/** Set a subtree configuration during component initialization, isolated for each SSR tree. */
export function setImageConfig(config: ImageContextConfig): ImageContextConfig {
  return setContext(key, config);
}
/** Read the current subtree configuration without module-global mutable state. */
export function getImageConfig(): ImageContextConfig {
  return getContext<ImageContextConfig>(key) ?? publicConfig;
}

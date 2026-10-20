import type { SerializableProvider } from './shared.js';
import { edge } from './edge.js';
/** Portable URL builder for the Node/Kit Sharp endpoint; never imports Sharp. */
export function local(options: Parameters<typeof edge>[0] = {}): SerializableProvider {
  const result = edge(options);
  return { ...result, name: 'local', descriptor: { factory: 'local', options: { ...options } } };
}

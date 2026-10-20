import type { SerializableProvider } from './shared.js';
import { edge } from './edge.js';
/** CloudFront is a CDN, not an optimizer: route /_img/v1 to the Imageway origin and forward the canonical query. */
export function cloudfront(options: { base: string }): SerializableProvider {
  return { ...edge(options), name: 'cloudfront', descriptor: { factory: 'cloudfront', options } };
}

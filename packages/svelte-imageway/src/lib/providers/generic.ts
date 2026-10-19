import { provider, rasterCapabilities, source } from './shared.js';
import { invariant } from '../core/errors.js';
import type { ProviderCapabilities } from '../core/types.js';
/** Build a custom provider using an encoded template; no eval or client secrets. */
export function generic(options: {
  template: string;
  capabilities?: Partial<ProviderCapabilities>;
}) {
  invariant(
    /^https:\/\//.test(options.template) && /\{(?:source|url|key)\}/.test(options.template),
    'PROVIDER',
    'Generic templates require HTTPS and a {source}, {url}, or {key} slot.',
  );
  return provider(
    'generic',
    { ...rasterCapabilities, ...options.capabilities },
    (r) =>
      options.template.replace(/\{(\w+)\}/g, (_all, key: string) =>
        encodeURIComponent(String(key === 'source' ? source(r) : (r[key as keyof typeof r] ?? ''))),
      ),
    { factory: 'generic', options: { template: options.template } },
  );
}

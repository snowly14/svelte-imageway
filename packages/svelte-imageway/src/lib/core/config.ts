import type { ImageConfig } from './types.js';
import { invariant } from './errors.js';

/** Safe defaults: remote processing is denied until origins are explicitly authorized. */
export const defaults: ImageConfig = Object.freeze({
  widths: Object.freeze([320, 480, 640, 768, 960, 1280, 1600, 1920, 2560]),
  qualities: Object.freeze([50, 65, 75, 85, 95]),
  formats: Object.freeze(['avif', 'webp', 'jpeg'] as const),
  quality: 75, maxDimension: 4096, maxPixels: 40_000_000,
  maxInputBytes: 20_000_000, maxOutputBytes: 20_000_000, timeoutMs: 10_000,
  allowedOrigins: Object.freeze([]), endpoint: '/_img/v1', placeholder: 'lqip',
  presets: Object.freeze<ImageConfig['presets']>({
    thumb: { values: { w: 320, h: 320, fit: 'cover' }, overrides: ['format', 'q', 'dpr'], revision: '1' },
    card: { values: { w: 640, fit: 'inside' }, overrides: ['w', 'format', 'q', 'dpr'], revision: '1' },
    hero: { values: { w: 1920, fit: 'inside' }, overrides: ['w', 'format', 'q', 'dpr'], revision: '1' },
    og: { values: { w: 1200, h: 630, fit: 'cover', format: 'jpeg' }, overrides: [], revision: '1' },
  }),
});
for (const preset of Object.values(defaults.presets)) { Object.freeze(preset.values); Object.freeze(preset.overrides); Object.freeze(preset); }
const formats = ['avif', 'webp', 'jpeg', 'png', 'gif', 'svg'];
/** Define and validate a central configuration. Secrets are intentionally excluded. */
export function defineConfig(input: Partial<ImageConfig> = {}): ImageConfig {
  const config = { ...defaults, ...input };
  for (const key of ['maxDimension', 'maxPixels', 'maxInputBytes', 'maxOutputBytes', 'timeoutMs'] as const) {
    invariant(Number.isSafeInteger(config[key]) && config[key] > 0, 'CONFIG', `${key} must be a positive integer.`);
  }
  for (const key of ['widths', 'qualities'] as const) {
    const values = config[key];
    invariant(values.length > 0 && values.length <= 32 && values.every((v, i) => Number.isSafeInteger(v) && v > 0 && (i === 0 || v > values[i - 1]!)), 'CONFIG', `${key} must contain 1–32 increasing positive integers.`);
  }
  invariant(config.widths.every(v => v <= config.maxDimension), 'CONFIG', 'Widths exceed maxDimension.');
  invariant(config.qualities.every(v => v <= 100) && config.qualities.includes(config.quality), 'CONFIG', 'quality must belong to qualities (1–100).');
  invariant(config.formats.length > 0 && config.formats.every(v => formats.includes(v)), 'CONFIG', 'Unsupported output format.');
  invariant(/^\/[\w/-]+$/.test(config.endpoint) && !config.endpoint.includes('..'), 'CONFIG', 'endpoint must be an absolute safe path.');
  invariant(['lqip', 'color', 'none', 'thumbhash', 'blurhash'].includes(config.placeholder), 'CONFIG', 'Invalid placeholder strategy.');
  for (const origin of config.allowedOrigins) {
    let parsed: URL;
    try { parsed = new URL(origin); } catch { throw new Error('allowedOrigins must contain HTTPS origins.'); }
    invariant(parsed.protocol === 'https:' && parsed.origin === origin && !parsed.username && !parsed.password && (!parsed.port || parsed.port === '443'), 'CONFIG', 'allowedOrigins must contain exact HTTPS origins without paths or custom ports.');
  }
  for (const [name, preset] of Object.entries(config.presets)) {
    invariant(/^[a-z][a-z0-9-]{0,31}$/.test(name) && /^[\w.-]{1,32}$/.test(preset.revision), 'CONFIG', 'Invalid preset name or revision.');
    invariant(!preset.values.preset && !preset.values.sig && !preset.values.url && !preset.values.key, 'CONFIG', 'Presets cannot contain sources, signatures, or nested presets.');
  }
  return Object.freeze({ ...config, widths: Object.freeze([...config.widths]), qualities: Object.freeze([...config.qualities]), formats: Object.freeze([...config.formats]), allowedOrigins: Object.freeze([...config.allowedOrigins]), presets: Object.freeze(Object.fromEntries(Object.entries(config.presets).map(([name, preset]) => [name, Object.freeze({ ...preset, values: Object.freeze({ ...preset.values }), overrides: Object.freeze([...preset.overrides]) })]))) });
}

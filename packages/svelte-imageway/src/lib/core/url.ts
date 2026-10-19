import { defaults } from './config.js';
import { invariant } from './errors.js';
import type { ImageConfig, ImageRequest, NormalizedRequest } from './types.js';

const names = ['url', 'key', 'w', 'h', 'dpr', 'q', 'format', 'fit', 'position', 'blur', 'sharpen', 'bg', 'rotate', 'flip', 'metadata', 'animation', 'preset', 'rev', 'kid', 'exp', 'sig'] as const;
const numeric = new Set(['w', 'h', 'dpr', 'q', 'blur', 'sharpen', 'rotate', 'exp']);
const enums = {
  format: ['avif', 'webp', 'jpeg', 'png', 'gif', 'svg', 'auto'],
  fit: ['cover', 'contain', 'fill', 'inside', 'outside', 'scale-down'],
  position: ['center', 'top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'attention', 'entropy'],
  flip: ['none', 'horizontal', 'vertical', 'both'], metadata: ['none', 'icc', 'safe'], animation: ['preserve', 'first'],
};
const base = { dpr: 1, q: 75, format: 'auto', fit: 'inside', position: 'center', metadata: 'none', animation: 'preserve', rotate: 0, flip: 'none', blur: 0, sharpen: 0 } as const;

/** Strictly parse one URL query; duplicate/unknown keys and malformed encodings are errors. */
export function parseRequest(query: string, config: ImageConfig = defaults): NormalizedRequest {
  const raw = query.startsWith('?') ? query.slice(1) : query;
  invariant(raw.length <= 8192 && !/%(?![\da-f]{2})/i.test(raw), 'QUERY', 'Invalid or oversized query.');
  try { decodeURIComponent(raw.replace(/\+/g, ' ')); } catch { invariant(false, 'QUERY', 'Invalid UTF-8 query encoding.'); }
  const seen = new Set<string>();
  const value: Record<string, string | number> = {};
  for (const [key, val] of new URLSearchParams(raw)) {
    invariant(names.includes(key as typeof names[number]) && !seen.has(key) && val !== '', 'QUERY', `Unknown, empty, or duplicate parameter: ${key}.`);
    seen.add(key);
    if (numeric.has(key)) invariant(/^\d+(?:\.\d+)?$/.test(val), 'QUERY', `Invalid number: ${key}.`);
    value[key] = numeric.has(key) ? Number(val) : val;
  }
  return normalizeRequest(value as ImageRequest, config);
}
/** Normalize source, bounded transformations, and locked presets before signing/caching. */
export function normalizeRequest(input: ImageRequest, config: ImageConfig = defaults): NormalizedRequest {
  invariant(Object.keys(input).every(k => names.includes(k as typeof names[number])), 'QUERY', 'Unknown image parameter.');
  invariant(Boolean(input.url) !== Boolean(input.key), 'SOURCE', 'Provide exactly one source: url or key.');
  if (input.url) {
    let source: URL;
    try { source = new URL(input.url); } catch { invariant(false, 'SOURCE', 'Source must be an absolute HTTPS URL.'); }
    invariant(source!.protocol === 'https:' && !source!.username && !source!.password && !source!.hash && (!source!.port || source!.port === '443') && ![...input.url].some(c => c.charCodeAt(0) <= 32 || c === '\\'), 'SOURCE', 'Only credential-free HTTPS sources on port 443 are supported.');
  }
  if (input.key) invariant(input.key.length <= 1024 && /^[\w./-]+$/.test(input.key) && !input.key.startsWith('/') && input.key.split('/').every(v => v !== '..' && v !== '.' && v !== ''), 'KEY', 'Object key must be relative and cannot traverse directories.');
  let values = input;
  if (input.preset) {
    const preset = Object.hasOwn(config.presets, input.preset) ? config.presets[input.preset] : undefined;
    invariant(preset, 'PRESET', 'Unknown image preset.', 403);
    for (const key of Object.keys(input) as (keyof ImageRequest)[]) {
      if (['url', 'key', 'preset', 'rev', 'kid', 'exp', 'sig'].includes(key)) continue;
      // Canonical URLs contain defaults; an identical locked value is not an override.
      const locked = preset.values[key] ?? base[key as keyof typeof base];
      invariant(preset.overrides.includes(key) || input[key] === locked, 'PRESET', `Preset locks ${key}.`, 403);
    }
    values = { ...preset.values, ...input };
  }
  const r = { ...base, q: config.quality, ...values } as NormalizedRequest;
  if ((r.format as string) === 'jpg') r.format = 'jpeg';
  for (const [key, allowed] of Object.entries(enums)) invariant(allowed.includes(String(r[key as keyof typeof enums])), 'VALUE', `Invalid ${key}.`);
  for (const key of ['w', 'h', 'q', 'rotate', 'exp'] as const) if (r[key] !== undefined) invariant(Number.isSafeInteger(r[key]) && r[key]! >= 0, 'VALUE', `${key} must be a nonnegative safe integer.`);
  for (const key of ['w', 'h'] as const) if (r[key] !== undefined) invariant(r[key]! > 0 && r[key]! <= config.maxDimension, 'LIMIT', `${key} exceeds configured limits.`, 413);
  invariant([1, 1.5, 2, 3].includes(r.dpr) && [0, 90, 180, 270].includes(r.rotate), 'VALUE', 'Unsupported DPR or rotation.');
  invariant(r.q >= 1 && r.q <= 100, 'VALUE', 'Quality must be between 1 and 100.');
  if (r.w && (!input.preset || config.presets[input.preset]!.overrides.includes('w'))) r.w = bucket(r.w, config.widths);
  r.q = bucket(r.q, config.qualities);
  invariant([r.blur, r.sharpen].every(Number.isFinite) && r.blur >= 0 && r.blur <= 20 && r.sharpen >= 0 && r.sharpen <= 10, 'VALUE', 'Blur or sharpen exceeds bounds.');
  if (r.bg !== undefined) { r.bg = r.bg.toLowerCase(); invariant(/^(transparent|[a-f\d]{6}|[a-f\d]{8})$/.test(r.bg), 'VALUE', 'Invalid background color.'); }
  for (const key of ['rev', 'kid'] as const) if (r[key] !== undefined) invariant(/^[\w.-]{1,128}$/.test(r[key]!), 'VALUE', `Invalid ${key}.`);
  if (r.sig !== undefined) invariant(/^[\w-]{43}$/.test(r.sig), 'SIGNATURE', 'Invalid signature encoding.', 401);
  invariant((r.w ?? 1) * r.dpr <= config.maxDimension && (r.h ?? 1) * r.dpr <= config.maxDimension && (r.w ?? 1) * (r.h ?? 1) * r.dpr ** 2 <= config.maxPixels, 'LIMIT', 'Physical image dimensions exceed limits.', 413);
  return Object.freeze(r);
}
function bucket(value: number, ladder: readonly number[]): number {
  const result = ladder.find(v => v >= value);
  invariant(result !== undefined, 'LIMIT', 'Requested variant exceeds the configured ladder.', 413);
  return result;
}
/** RFC3986 query encoding with ASCII sorting and no raw source-query mutation. */
export function canonicalQuery(request: ImageRequest, includeSignature = true): string {
  return Object.entries(request).filter(([key, value]) => value !== undefined && (includeSignature || key !== 'sig')).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, value]) => `${encode(key)}=${encode(String(value))}`).join('&');
}
function encode(value: string): string { return encodeURIComponent(value).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`); }
/** Build a portable service URL from a normalized request. */
export function imageUrl(request: ImageRequest, config: ImageConfig = defaults): string {
  return `${config.endpoint}?${canonicalQuery(normalizeRequest(request, config))}`;
}
/** Stable representation identity, including pipeline and preset policy revisions. */
export function cacheIdentity(request: NormalizedRequest, format: string, pipeline: string, config: ImageConfig = defaults, namespace = 'public'): string {
  const { sig: _sig, exp: _exp, kid: _kid, ...output } = request;
  void _sig; void _exp; void _kid;
  return JSON.stringify([namespace, pipeline, request.preset ? config.presets[request.preset]?.revision : '', canonicalQuery({ ...output, format: format as ImageRequest['format'] })]);
}

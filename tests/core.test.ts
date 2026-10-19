import { describe, expect, expectTypeOf, it } from 'vitest';
import { cacheIdentity, canonicalQuery, defaults, defineConfig, imageUrl, ImagewayError, mimeType, negotiateFormat, normalizeRequest, parseRequest, signRequest, verifyRequest } from '../packages/svelte-imageway/src/lib/core/index.js';
import type { ImageRequest, NormalizedRequest } from '../packages/svelte-imageway/src/lib/core/types.js';

const secret = 'a-test-key-with-more-than-32-bytes-long';
describe('v1 request contract', () => {
  it('normalizes variants and round-trips a signed upstream query without altering it', () => {
    const url = 'https://images.example/a.jpg?X-Signature=a%2Fb&x=hello+world&x=2';
    const r = normalizeRequest({ url, w: 401, q: 66, bg: 'FFAA00' });
    expect(r).toMatchObject({ w: 480, q: 75, bg: 'ffaa00', dpr: 1 });
    expect(parseRequest(canonicalQuery(r))).toEqual(r);
    expect(r.url).toBe(url);
    expect(imageUrl({ key: 'a/photo.jpg', w: 320 })).toMatch(/^\/_img\/v1\?animation=/);
    expect(parseRequest('?key=x&w=320&format=jpg').format).toBe('jpeg');
    expectTypeOf(r).toEqualTypeOf<NormalizedRequest>();
    expect(canonicalQuery({ key: "a!b'c(d)*e f" })).toBe('key=a%21b%27c%28d%29%2Ae%20f');
    expect(canonicalQuery({ key: 'x', sig: 'a', q: undefined }, false)).toBe('key=x');
  });
  it.each(['key=a&key=b', 'key=', 'key=a&unknown=2', 'key=a&w=1e3', 'key=%zz', 'key=%ff', 'key=a&w=NaN', `key=${'a'.repeat(8193)}`])('rejects malformed or ambiguous query %s', query => expect(() => parseRequest(query)).toThrow(ImagewayError));
  it.each([
    {}, { key: 'x', url: 'https://example.com/x' }, { url: 'invalid' }, { url: 'http://example.com/x' }, { url: 'https://u:p@example.com/x' }, { url: 'https://example.com:444/x' }, { url: 'https://example.com/x#frag' }, { url: 'https://example.com/x y' },
    { key: '../x' }, { key: '/x' }, { key: 'a//b' }, { key: 'a/./b' }, { key: '%2e%2e/x' }, { key: 'a', w: 0 }, { key: 'a', w: -1 }, { key: 'a', w: 0.2 }, { key: 'a', w: 5000 }, { key: 'a', w: 3000 }, { key: 'a', w: 2560, dpr: 3 },
    { key: 'a', h: 5000 }, { key: 'a', q: 0 }, { key: 'a', q: 101 }, { key: 'a', q: 99 }, { key: 'a', q: 2.5 }, { key: 'a', dpr: 1.3 }, { key: 'a', rotate: 45 }, { key: 'a', blur: 21 }, { key: 'a', sharpen: -1 }, { key: 'a', blur: NaN },
    { key: 'a', bg: '#fff' }, { key: 'a', rev: 'a&b' }, { key: 'a', kid: '/' }, { key: 'a', sig: 'short' }, { key: 'a', format: 'bmp' }, { key: 'a', fit: 'invalid' }, { key: 'a', unknown: 1 },
  ])('rejects unsafe/out-of-bound request %#', input => expect(() => normalizeRequest(input as ImageRequest)).toThrow());
  it('enforces physical decoded pixel limits', () => {
    expect(() => normalizeRequest({ key: 'x', w: 640, h: 640 }, defineConfig({ maxPixels: 1000 }))).toThrow(/Physical/);
  });
  it('locks presets and can round-trip expanded canonical values', () => {
    const r = normalizeRequest({ key: 'x', preset: 'og' });
    expect(r.w).toBe(1200); expect(r.h).toBe(630); expect(r.format).toBe('jpeg');
    expect(parseRequest(canonicalQuery(r))).toEqual(r);
    expect(() => normalizeRequest({ key: 'x', preset: 'og', w: 320 })).toThrow(/locks/);
    expect(() => normalizeRequest({ key: 'x', preset: 'missing' })).toThrow(/Unknown image preset/);
    expect(normalizeRequest({ key: 'x', preset: 'hero', w: 640 }).w).toBe(640);
  });
  it('keys output independently of auth tokens but includes pipeline, tenant, preset and format', () => {
    const r = normalizeRequest({ key: 'x', preset: 'hero' });
    const id = cacheIdentity(r, 'webp', '1');
    expect(cacheIdentity({ ...r, sig: 'token', exp: 123, kid: 'old' }, 'webp', '1')).toBe(id);
    for (const other of [cacheIdentity(r, 'avif', '1'), cacheIdentity(r, 'webp', '2'), cacheIdentity(r, 'webp', '1', defaults, 'tenant-2'), cacheIdentity(normalizeRequest({ key: 'x' }), 'webp', '1')]) expect(other).not.toBe(id);
    const updated = defineConfig({ presets: { hero: { ...defaults.presets.hero!, revision: '2' } } });
    expect(cacheIdentity(r, 'webp', '1', updated)).not.toBe(id);
  });
});
describe('configuration', () => {
  it('is immutable and denies remote input by default', () => {
    const values = [320, 640];
    const r = defineConfig({ widths: values, allowedOrigins: ['https://images.example'] });
    values.push(1280); expect(r.widths).toEqual([320, 640]); expect(Object.isFrozen(r)).toBe(true);
    expect(defineConfig().allowedOrigins).toEqual([]);
  });
  it.each([
    { maxDimension: 0 }, { maxPixels: -1 }, { maxInputBytes: 0.1 }, { maxOutputBytes: NaN }, { timeoutMs: 0 },
    { widths: [] }, { widths: [320, 320] }, { widths: [640, 320] }, { widths: [5000] }, { widths: [0] }, { widths: Array.from({ length: 33 }, (_, i) => i + 1) },
    { qualities: [101] }, { quality: 74 }, { formats: [] }, { formats: ['bmp'] }, { endpoint: 'relative' }, { endpoint: '/a/../b' }, { placeholder: 'evil' },
    { allowedOrigins: ['bad'] }, { allowedOrigins: ['http://images.example'] }, { allowedOrigins: ['https://images.example/'] }, { allowedOrigins: ['https://u:p@images.example'] }, { allowedOrigins: ['https://images.example:123'] },
    { presets: { 'INVALID': { values: {}, overrides: [], revision: '1' } } }, { presets: { x: { values: { key: 'secret' }, overrides: [], revision: '1' } } }, { presets: { x: { values: {}, overrides: [], revision: '/' } } },
  ])('rejects invalid configuration %#', input => expect(() => defineConfig(input as Parameters<typeof defineConfig>[0])).toThrow());
});
describe('Accept negotiation', () => {
  it.each([
    [null, 'avif'], ['image/avif,image/webp,*/*;q=0.8', 'avif'], ['image/avif;q=0,image/*', 'webp'],
    ['image/avif;q=0.5,image/webp;q=0.9', 'webp'], ['image/jpeg', 'jpeg'], ['image/webp;q=bad,image/jpeg', 'jpeg'], ['image/avif;q=2,image/jpeg', 'jpeg'], ['image/webp;q=-1,image/jpeg', 'jpeg'],
  ])('negotiates %s into %s', (accept, format) => expect(negotiateFormat(accept)).toBe(format));
  it('rejects unacceptable media and formats', () => { expect(() => negotiateFormat('text/html')).toThrow(/No acceptable/); expect(() => negotiateFormat('*/*;q=0')).toThrow(); expect(mimeType('svg')).toBe('image/svg+xml'); expect(mimeType('png')).toBe('image/png'); });
});
describe('HMAC authorization', () => {
  it('verifies canonical equivalents and rotated keys and excludes cached authorization reuse', async () => {
    const signed = await signRequest({ key: 'x', w: 320 }, { secret, kid: 'old', exp: 200 });
    expect(signed.sig).toHaveLength(43);
    expect(await verifyRequest(signed, { old: secret, current: `${secret}new` }, { now: 100 })).toEqual(signed);
    const parsed = parseRequest(canonicalQuery(signed).split('&').reverse().join('&'));
    expect(await verifyRequest(parsed, { old: secret }, { now: 199 })).toEqual(signed);
    await expect(verifyRequest(signed, { old: secret }, { now: 200 })).rejects.toThrow(/expired/);
    await expect(verifyRequest({ ...signed, w: 640 }, { old: secret }, { now: 100 })).rejects.toThrow(/signature/);
    await expect(verifyRequest(signed, {}, { now: 100 })).rejects.toThrow(/required/);
    await expect(verifyRequest(signed, { old: secret }, { now: 0, maxLifetime: 50 })).rejects.toThrow(/lifetime/);
    await expect(verifyRequest({ key: 'x' }, {}, { now: 0 })).rejects.toThrow(/required/);
    const now = Math.floor(Date.now() / 1000);
    const current = await signRequest({ key: 'x' }, { secret, kid: 'current', exp: now + 60 });
    expect(await verifyRequest(current, { current: secret })).toEqual(current);
    await expect(signRequest({ key: 'x' }, { secret: 'short', kid: 'x', exp: 100 })).rejects.toThrow(/32 bytes/);
    const config = defineConfig({ endpoint: '/different/v1' });
    const separate = await signRequest({ key: 'x' }, { secret, kid: 'x', exp: 200, config });
    expect(await verifyRequest(separate, { x: secret }, { now: 100, config })).toEqual(separate);
    await expect(verifyRequest(separate, { x: secret }, { now: 100 })).rejects.toThrow(/signature/);
  });
});

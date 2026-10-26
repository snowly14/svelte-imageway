import { expect, it } from 'vitest';
import { canonicalQuery } from '../packages/svelte-imageway/src/lib/core/url.js';
import { canonicalControl } from '../bench/url-serialization/control.js';
import type { ImageRequest } from '../packages/svelte-imageway/src/lib/core/types.js';

it('keeps RFC3986 bytes for every ASCII/Latin1 character, unicode and malformed UTF16', () => {
  const texts = [
    '',
    'safe_Az.09~-',
    'line\n',
    'line\r\n',
    'line\u2028',
    '\0',
    '😀',
    'é雪',
    '\ud800',
    '\udfff',
    "!'()* +/%?&=#",
  ];
  for (let code = 0; code < 256; code++) texts.push('prefix' + String.fromCharCode(code));
  for (const text of texts) {
    const input: ImageRequest = { key: text, url: undefined, sig: 'safe-signature', q: 75 };
    for (const signature of [true, false]) {
      let expected: string;
      try {
        expected = canonicalControl(input, signature);
      } catch (error) {
        expect(error).toBeInstanceOf(URIError);
        expect(() => canonicalQuery(input, signature)).toThrow(URIError);
        continue;
      }
      expect(canonicalQuery(input, signature)).toBe(expected);
    }
  }
  expect(canonicalQuery({ key: 'safe\n' })).toBe('key=safe%0A');
});
it('preserves unknown/Unicode key ordering, excluded fields and one-time getter coercion', () => {
  let state = 0x12345678;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state;
  };
  const keys = [
    'key',
    'q',
    'sig',
    'exp',
    'other',
    '10',
    '2',
    'é',
    '😀',
    '\ue000',
    'line\n',
    '__proto__',
  ];
  for (let sample = 0; sample < 1024; sample++) {
    const input: Record<string, string | number | undefined> = { key: 'a/photo.jpg' };
    for (const key of keys)
      if (next() % 3)
        Object.defineProperty(input, key, {
          value: next() % 4 ? `x${next()} !()*雪` : undefined,
          enumerable: true,
          configurable: true,
        });
    const request = input as ImageRequest;
    expect(canonicalQuery(request, true)).toBe(canonicalControl(request, true));
    expect(canonicalQuery(request, false)).toBe(canonicalControl(request, false));
  }
  const run = (canonical: typeof canonicalQuery) => {
    const calls: string[] = [];
    const input = {
      get key() {
        calls.push('get-key');
        return {
          toString() {
            calls.push('string-key');
            return "a!'";
          },
        };
      },
      get sig() {
        calls.push('get-sig');
        return 'excluded';
      },
      get q() {
        calls.push('get-q');
        return undefined;
      },
    };
    const output = canonical(input as unknown as ImageRequest, false);
    return { calls, output };
  };
  expect(run(canonicalQuery)).toEqual(run(canonicalControl));
});

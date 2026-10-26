import type { ImageRequest } from '../../packages/svelte-imageway/src/lib/core/types.js';
const encode = (value: string, fast: boolean) =>
  fast && !/[^\w.~-]/.test(value)
    ? value
    : encodeURIComponent(value).replace(
        /[!'()*]/g,
        (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
      );
/** Old array pipeline with an optional unreserved fast path, or the loop with native encoding. */
export function canonicalControl(
  request: ImageRequest,
  includeSignature = true,
  fast = false,
  loop = false,
): string {
  const entries = Object.entries(request);
  const sort = ([a]: [string, unknown], [b]: [string, unknown]) => (a < b ? -1 : a > b ? 1 : 0);
  if (!loop)
    return entries
      .filter(([k, v]) => v !== undefined && (includeSignature || k !== 'sig'))
      .sort(sort)
      .map(([k, v]) => `${encode(k, fast)}=${encode(String(v), fast)}`)
      .join('&');
  let output = '';
  for (const [k, v] of entries.sort(sort))
    if (v !== undefined && (includeSignature || k !== 'sig'))
      output += `${output ? '&' : ''}${encode(k, fast)}=${encode(String(v), fast)}`;
  return output;
}

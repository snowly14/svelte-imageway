import { lookup } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import { isIP, type LookupFunction } from 'node:net';
import { open, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import ipaddr from 'ipaddr.js';
import { defaults } from '../core/config.js';
import { ImagewayError, invariant } from '../core/errors.js';
import type { ImageConfig } from '../core/types.js';

/** Publicly routable IPs only; IPv4-mapped IPv6 is normalized before classification. */
export function isPublicAddress(address: string): boolean {
  try {
    const parsed = ipaddr.process(address);
    return (
      parsed.range() === 'unicast' &&
      (parsed.kind() === 'ipv4' || parsed.match(ipaddr.parse('2000::'), 3))
    );
  } catch {
    return false;
  }
}
export interface PinnedSource {
  url: URL;
  address: string;
  family: 4 | 6;
}
/** Resolve every address and pin the chosen public destination to prevent DNS rebinding. */
export async function authorizeRemote(
  source: string,
  config: ImageConfig = defaults,
  resolveDns: typeof lookup = lookup,
): Promise<PinnedSource> {
  const url = new URL(source);
  invariant(
    url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.hash &&
      (!url.port || url.port === '443') &&
      config.allowedOrigins.includes(url.origin),
    'ORIGIN',
    'Remote origin is not allowed. Configure allowedOrigins explicitly.',
    403,
  );
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const literal = isIP(hostname);
  const addresses = literal
    ? [{ address: hostname, family: literal }]
    : await resolveDns(hostname, { all: true, verbatim: true });
  invariant(
    addresses.length > 0 && addresses.every((v) => isPublicAddress(v.address)),
    'SSRF',
    'Remote source resolved to a prohibited destination.',
    403,
  );
  const chosen = addresses[0]!;
  return { url, address: chosen.address, family: chosen.family as 4 | 6 };
}
/** Read an approved local key without following a symlink outside its source root. */
export async function readLocal(
  key: string,
  root: string,
  maxBytes = defaults.maxInputBytes,
): Promise<Buffer> {
  invariant(
    /^[\w./-]+$/.test(key) &&
      !key.startsWith('/') &&
      key.split('/').every((v) => v && v !== '.' && v !== '..'),
    'TRAVERSAL',
    'Invalid local source key.',
    403,
  );
  const base = await realpath(root);
  const path = await realpath(resolve(base, key));
  const rel = relative(base, path);
  invariant(
    rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !rel.startsWith(sep),
    'TRAVERSAL',
    'Local source escapes its configured root.',
    403,
  );
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await file.stat();
    invariant(
      stat.isFile() && stat.size <= maxBytes,
      'INPUT_SIZE',
      'Local input exceeds byte limit or is not a file.',
      413,
    );
    // Read at most limit+1 even if the file changes after stat.
    const data = Buffer.alloc(Math.min(stat.size + 1, maxBytes + 1));
    let used = 0;
    while (used < data.length) {
      const { bytesRead } = await file.read(data, used, data.length - used, used);
      if (!bytesRead) break;
      used += bytesRead;
    }
    invariant(
      used <= maxBytes && used <= stat.size,
      'INPUT_SIZE',
      'Local input changed or exceeds byte limit.',
      413,
    );
    return data.subarray(0, used);
  } finally {
    await file.close();
  }
}
export interface RemoteResponse {
  status: number;
  headers: Record<string, string | undefined>;
  body: Buffer;
}
export type RemoteTransport = (
  source: PinnedSource,
  config: ImageConfig,
  signal: AbortSignal,
) => Promise<RemoteResponse>;
/** Fetch approved sources with a single deadline, bounded redirects and a pinned TLS connection. */
export async function fetchRemote(
  source: string,
  config: ImageConfig = defaults,
  deps: { resolveDns?: typeof lookup; transport?: RemoteTransport } = {},
): Promise<Buffer> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new ImagewayError('TIMEOUT', 'Remote source timed out.', 504));
    }, config.timeoutMs);
  });
  let current = source;
  try {
    const operation = async () => {
      for (let hop = 0; hop <= 3; hop++) {
        if (controller.signal.aborted)
          throw new ImagewayError('TIMEOUT', 'Remote source timed out.', 504);
        const pinned = await authorizeRemote(current, config, deps.resolveDns);
        const response = await (deps.transport ?? transport)(pinned, config, controller.signal);
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          invariant(
            hop < 3 && response.headers.location,
            'REDIRECT',
            'Too many or invalid source redirects.',
            502,
          );
          current = new URL(response.headers.location!, current).href;
          continue;
        }
        invariant(
          response.status === 200,
          'UPSTREAM',
          'Approved source did not return an image.',
          502,
        );
        invariant(
          response.body.length <= config.maxInputBytes,
          'INPUT_SIZE',
          'Remote input exceeds byte limit.',
          413,
        );
        return response.body;
      }
      throw new ImagewayError('REDIRECT', 'Source redirect limit reached.', 502);
    };
    return await Promise.race([operation(), deadline]);
  } catch (error) {
    if (controller.signal.aborted)
      throw new ImagewayError('TIMEOUT', 'Remote source timed out.', 504);
    if (error instanceof ImagewayError) throw error;
    throw new ImagewayError('UPSTREAM', 'Approved source could not be fetched.', 502);
  } finally {
    clearTimeout(timer!);
  }
}
const transport: RemoteTransport = (source, config, signal) =>
  new Promise((resolveResponse, reject) => {
    const lookupPinned: LookupFunction = (_host, options, callback) => {
      if (options.all) callback(null, [{ address: source.address, family: source.family }]);
      else callback(null, source.address, source.family);
    };
    const req = httpsRequest(
      source.url,
      {
        lookup: lookupPinned,
        agent: false,
        signal,
        headers: {
          Accept: 'image/*',
          'Accept-Encoding': 'identity',
          'User-Agent': 'svelte-imageway/0.1',
        },
      },
      (response) => {
        const status = response.statusCode ?? 502;
        const headers = { location: response.headers.location };
        if (status !== 200) {
          response.destroy();
          resolveResponse({ status, headers, body: Buffer.alloc(0) });
          return;
        }
        if (
          Number(response.headers['content-length']) > config.maxInputBytes ||
          (response.headers['content-encoding'] &&
            response.headers['content-encoding'] !== 'identity')
        ) {
          response.destroy();
          reject(new ImagewayError('INPUT_SIZE', 'Compressed or oversized source rejected.', 413));
          return;
        }
        const chunks: Buffer[] = [];
        let length = 0;
        response.on('data', (chunk: Buffer) => {
          length += chunk.length;
          if (length > config.maxInputBytes) {
            response.destroy(
              new ImagewayError('INPUT_SIZE', 'Remote input exceeds byte limit.', 413),
            );
            return;
          }
          chunks.push(chunk);
        });
        response.on('error', reject);
        response.on('end', () => resolveResponse({ status, headers, body: Buffer.concat(chunks) }));
      },
    );
    req.on('error', reject);
    req.end();
  });

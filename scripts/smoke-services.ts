import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { signRequest, canonicalQuery } from '../packages/svelte-imageway/src/lib/core/index.js';
const result: Record<string, unknown> = {};
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
async function image(base: string, query: string) {
  const response = await fetch(base + '/_img/v1?' + query, { headers: { Accept: 'image/webp' } });
  assert(
    response.status === 200,
    `${base} image failed: ${response.status} ${await response.clone().text()}`,
  );
  const bytes = Buffer.from(await response.arrayBuffer());
  const info = await sharp(bytes).metadata();
  assert(
    info.width === 640 && response.headers.get('content-type') === 'image/webp',
    'Wrong encoded output/dimensions.',
  );
  let warmed = response;
  for (let i = 0; i < 10 && warmed.headers.get('x-imageway-cache') !== 'HIT'; i++)
    warmed = await fetch(base + '/_img/v1?' + query, { headers: { Accept: 'image/webp' } });
  assert(warmed.headers.get('x-imageway-cache') === 'HIT', `${base}: no warm cache hit.`);
  const conditional = await fetch(base + '/_img/v1?' + query, {
    headers: { 'If-None-Match': response.headers.get('etag')!, Accept: 'image/webp' },
  });
  assert(conditional.status === 304, `${base}: conditional GET failed.`);
  const head = await fetch(base + '/_img/v1?' + query, { method: 'HEAD' });
  assert(
    head.status === 200 && (await head.arrayBuffer()).byteLength === 0,
    'HEAD returned a body.',
  );
  return {
    status: 200,
    format: info.format,
    width: info.width,
    height: info.height,
    etag: response.headers.get('etag'),
    warm: warmed.headers.get('x-imageway-cache'),
    conditional: conditional.status,
    cacheControl: response.headers.get('cache-control'),
  };
}
result.worker = await image(
  'http://127.0.0.1:8787',
  'key=images/landscape.png&preset=card&format=webp&w=640',
);
result.docker = await image(
  'http://127.0.0.1:8788',
  'key=source.png&preset=card&format=webp&w=640',
);
const tokens = JSON.parse(await readFile('.local/worker-test-tokens.json', 'utf8')) as Record<
  string,
  string
>;
const purge = await fetch('http://127.0.0.1:8787/purge', {
  method: 'POST',
  headers: { Authorization: `Bearer ${tokens.PURGE_TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ kind: 'prefix', value: 'images/' }),
});
assert(purge.ok, `Real Worker purge failed: ${purge.status} ${await purge.clone().text()}`);
result.workerPurge = await purge.json();
assert(
  (await fetch('http://127.0.0.1:8787/metrics')).status === 403,
  'Metrics exposed without authorization.',
);
const metrics = await fetch('http://127.0.0.1:8787/metrics', {
  headers: { Authorization: `Bearer ${tokens.METRICS_TOKEN}` },
});
assert(metrics.ok, 'Authorized metrics unavailable.');
result.workerMetrics = await metrics.json();
const expired = await signRequest(
  { key: 'images/landscape.png', preset: 'card', format: 'webp' },
  { secret: tokens.SIGNING_KEY_CURRENT!, kid: 'current', exp: Math.floor(Date.now() / 1000) - 1 },
);
assert(
  (await fetch('http://127.0.0.1:8787/_img/v1?' + canonicalQuery(expired))).status === 401,
  'Expired Worker signature accepted.',
);
assert(
  (
    await fetch(
      'http://127.0.0.1:8787/_img/v1?url=https%3A%2F%2F169.254.169.254%2Flatest&preset=card',
    )
  ).status === 403,
  'Worker proxy SSRF not rejected.',
);
for (const [runtime, port] of [
  ['node', 8790],
  ['bun', 8791],
] as const) {
  const child = spawn(runtime, ['packages/edge/server.mjs'], {
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '127.0.0.1',
      IMAGEWAY_SOURCE_ROOT: resolve('examples/node/static'),
      IMAGEWAY_CACHE_DIR: resolve(`.local/${runtime}-service-cache`),
      IMAGEWAY_PUBLIC_SOURCES: 'true',
    },
    stdio: 'pipe',
  });
  let stderr = '';
  child.stderr?.on('data', (bytes) => (stderr += bytes.toString()));
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) {
          ready = true;
          break;
        }
      } catch {
        /* Startup only. */
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    assert(ready, `${runtime} service did not start: ${stderr}`);
    result[runtime] = await image(
      `http://127.0.0.1:${port}`,
      'key=source.png&preset=card&format=webp&w=640',
    );
  } finally {
    child.kill('SIGTERM');
  }
}
await writeFile('.local/m5-services.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));

import { timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { createImageService } from '../svelte-imageway/dist/kit/handler.js';
const service = createImageService({
  sourceRoot: process.env.IMAGEWAY_SOURCE_ROOT ?? '/sources',
  cacheDirectory: process.env.IMAGEWAY_CACHE_DIR ?? '/cache',
  config: {
    allowedOrigins: (process.env.IMAGEWAY_ALLOWED_ORIGINS ?? '').split(',').filter(Boolean),
  },
  signingKeys: { current: 'IMAGEWAY_SIGNING_KEY', previous: 'IMAGEWAY_PREVIOUS_SIGNING_KEY' },
  requireSignature: process.env.IMAGEWAY_REQUIRE_SIGNATURE === 'true',
  publicSources: process.env.IMAGEWAY_PUBLIC_SOURCES === 'true',
  corsOrigin: process.env.IMAGEWAY_CORS_ORIGIN,
  maxRequestsPerMinute: Number(process.env.IMAGEWAY_REQUEST_LIMIT ?? 1000),
  maxTransformsPerHour: Number(process.env.IMAGEWAY_TRANSFORM_LIMIT ?? 10000),
  log: (event) => console.log(JSON.stringify({ event: 'imageway.error', ...event })),
});
const port = Number(process.env.PORT ?? 3000);
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://localhost:${port}`);
    if (url.pathname === '/health') {
      res.setHeader('Content-Type', 'application/json');
      res.end('{"status":"ok","service":"imageway"}');
      return;
    }
    if (url.pathname === '/metrics') {
      const configured = process.env.IMAGEWAY_METRICS_TOKEN;
      if (
        !configured ||
        configured.length < 32 ||
        !matchesToken(req.headers.authorization, configured)
      ) {
        res.statusCode = 403;
        res.end();
        return;
      }
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify(service.metrics));
      return;
    }
    const request = new Request(url, {
      method: req.method,
      headers: Object.entries(req.headers).flatMap(([key, value]) =>
        value ? [[key, Array.isArray(value) ? value.join(',') : value]] : [],
      ),
    });
    const response = await service.fetch(request);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body) Readable.fromWeb(response.body).pipe(res);
    else res.end();
  } catch {
    res.writeHead(500, { 'Cache-Control': 'no-store' });
    res.end('Image service failed.');
  }
});
server.listen(port, process.env.HOST ?? '0.0.0.0', () =>
  console.log(JSON.stringify({ event: 'imageway.listening', port })),
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => server.close(() => process.exit(0)));

function matchesToken(header, token) {
  const expected = Buffer.from(`Bearer ${token}`);
  const value = Buffer.from(header ?? '');
  return expected.length === value.length && timingSafeEqual(expected, value);
}

import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { createIPX, createIPXFetchHandler, ipxFSStorage } from 'ipx';
import { createImageService } from '../packages/svelte-imageway/dist/kit/handler.js';
const [engine, source, cache] = process.argv.slice(2) as [string, string, string];
const local =
  engine === 'imageway'
    ? createImageService({
        sourceRoot: source,
        cacheDirectory: cache,
        publicSources: true,
        maxRequestsPerMinute: 10000,
      })
    : undefined;
const handler =
  local?.fetch ??
  createIPXFetchHandler(
    createIPX({ storage: ipxFSStorage({ dir: source }), maxOutputDimension: 4096 }),
  );
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url!, 'http://127.0.0.1');
    if (url.pathname === '/_bench/stats') {
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          rssBytes: process.memoryUsage().rss,
          peakRssBytes: process.resourceUsage().maxRSS * 1024,
          metrics: local?.metrics,
        }),
      );
      return;
    }
    const r = await handler(new Request(url, { headers: { Accept: 'image/webp' } }));
    res.writeHead(r.status, Object.fromEntries(r.headers));
    if (r.body)
      Readable.fromWeb(r.body as unknown as Parameters<typeof Readable.fromWeb>[0]).pipe(res);
    else res.end();
  } catch {
    res.writeHead(500);
    res.end();
  }
});
server.listen(0, '127.0.0.1', () =>
  console.log(JSON.stringify({ port: (server.address() as { port: number }).port })),
);
process.on('SIGTERM', () => server.close(() => process.exit(0)));

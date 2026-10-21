import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
const results: Record<string, unknown>[] = [];
function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}
for (let run = 0; run < 3; run++)
  for (const engine of ['imageway', 'ipx']) {
    const cache = resolve('.local/bench/runtime-cache-' + engine);
    await rm(cache, { recursive: true, force: true });
    const child = spawn(
      'node',
      ['bench/server.ts', engine, resolve('.local/bench/fixtures'), cache],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let stderr = '';
    child.stderr.on('data', (b) => (stderr += b));
    const port = await new Promise<number>((done, reject) => {
      let output = '';
      child.stdout.on('data', (b) => {
        output += b;
        try {
          done(JSON.parse(output.trim()).port);
        } catch {
          /* Wait for full JSON. */
        }
      });
      child.on('error', reject);
      child.on('exit', (code) =>
        reject(new Error('Runtime server exited ' + code + ': ' + stderr)),
      );
    });
    try {
      const base = 'http://127.0.0.1:' + port;
      const url =
        base +
        (engine === 'imageway'
          ? '/_img/v1?key=landscape.png&preset=card&w=640&format=webp'
          : '/w_640,q_75,f_webp/landscape.png');
      const request = async () => {
        const start = performance.now();
        const response = await fetch(url);
        const ttfb = performance.now() - start;
        const bytes = Buffer.from(await response.arrayBuffer());
        if (!response.ok) throw new Error(engine + ' HTTP ' + response.status);
        return { ttfb, bytes, hit: response.headers.get('x-imageway-cache') };
      };
      const cold = await request();
      if ((await sharp(cold.bytes).metadata()).width !== 640) throw new Error('Invalid dimensions');
      const warm = [];
      let hits = 0;
      for (let i = 0; i < 30; i++) {
        const r = await request();
        warm.push(r.ttfb);
        if (r.hit === 'HIT') hits++;
      }
      const start = performance.now();
      let index = 0;
      await Promise.all(
        Array.from({ length: 4 }, async () => {
          while (index++ < 100) await request();
        }),
      );
      const duration = performance.now() - start;
      const stats = await (await fetch(base + '/_bench/stats')).json();
      results.push({
        run,
        engine,
        coldTtfbMs: cold.ttfb,
        warmMedianTtfbMs: median(warm),
        warmSamples: warm,
        warmCacheHitRate: engine === 'imageway' ? hits / 30 : null,
        requestsPerSecond: 100 / (duration / 1000),
        burstConcurrency: 4,
        outputBytes: cold.bytes.length,
        ...stats,
      });
    } finally {
      child.kill('SIGTERM');
    }
    await mkdir('bench/results', { recursive: true });
    await writeFile(
      'bench/results/runtime.json',
      JSON.stringify(
        {
          measuredAt: new Date().toISOString(),
          protocol:
            '3 fresh Node processes per engine; local HTTP; same source 640 WebP q75; first request then 30 repeats then 100 requests at concurrency4; Imageway built-in memory/disk cache vs IPX handler without an added CDN cache',
          results,
        },
        null,
        2,
      ) + '\n',
    );
  }
// Real local binding timing is kept distinct from the managed production service and the q75 encoder comparison.
const workerEndpoint = process.env.IMAGEWAY_BENCH_WORKER_URL;
if (workerEndpoint) {
  const worker = [];
  for (let i = 0; i < 30; i++) {
    const start = performance.now();
    const r = await fetch(workerEndpoint);
    const ttfb = performance.now() - start;
    await r.arrayBuffer();
    if (!r.ok) throw new Error('Worker ' + r.status);
    worker.push({ ttfb, cache: r.headers.get('x-imageway-cache') });
  }
  await writeFile(
    'bench/results/worker-local.json',
    JSON.stringify(
      {
        mode: 'Wrangler local Images binding emulator, not production Cloudflare; offline quality defaults apply',
        measuredAt: new Date().toISOString(),
        samples: worker,
        medianTtfbMs: median(worker.map((v) => v.ttfb)),
      },
      null,
      2,
    ) + '\n',
  );
} else
  console.log(
    'Worker benchmark skipped: set IMAGEWAY_BENCH_WORKER_URL to an explicit running endpoint.',
  );
console.log('Runtime benchmark complete.');

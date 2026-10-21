import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { cpus } from 'node:os';

const baseline = process.argv[2];
if (!baseline)
  throw new Error('Pass the baseline dist/kit/handler.js path; run bench:build first.');
const median = (values: number[]) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;
const rows: Array<{
  pair: number;
  variant: string;
  coldTtfbMs: number;
  warmMedianTtfbMs: number;
  requestsPerSecond: number;
  warmSamples: number[];
  outputDigest: string;
  outputBytes: number;
  peakRssBytes: number;
  node: string;
}> = [];
let expectedDigest: string | undefined;
for (let pair = 0; pair < 7; pair++) {
  for (const variant of pair % 2 ? ['after', 'before'] : ['before', 'after']) {
    const cache = resolve('.local/bench/runtime-paired-' + variant);
    await rm(cache, { recursive: true, force: true });
    const child = spawn(
      'node',
      ['bench/server.ts', 'imageway', resolve('.local/bench/fixtures'), cache],
      {
        env: {
          ...process.env,
          IMAGEWAY_BENCH_SERVICE: variant === 'before' ? resolve(baseline) : '',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    let stderr = '';
    child.stderr.on('data', (b) => (stderr += b));
    const exited = once(child, 'exit');
    try {
      const port = await new Promise<number>((done, reject) => {
        const timer = setTimeout(
          () => reject(new Error('Server startup timeout: ' + stderr)),
          15000,
        );
        let output = '';
        child.stdout.on('data', (b) => {
          output += b;
          try {
            const { port } = JSON.parse(output.trim());
            if (!Number.isSafeInteger(port)) return;
            clearTimeout(timer);
            done(port);
          } catch {
            /* Wait for the full ready message. */
          }
        });
        child.once('error', (e) => {
          clearTimeout(timer);
          reject(e);
        });
        child.once('exit', () => {
          clearTimeout(timer);
          reject(new Error('Server exited: ' + stderr));
        });
      });
      const base = 'http://127.0.0.1:' + port;
      const url = base + '/_img/v1?key=landscape.png&preset=card&w=640&format=webp';
      const request = async () => {
        const start = performance.now();
        const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
        const ttfb = performance.now() - start;
        const bytes = Buffer.from(await response.arrayBuffer());
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const digest = createHash('sha256').update(bytes).digest('hex');
        expectedDigest ??= digest;
        if (digest !== expectedDigest) throw new Error('Baseline/current response bytes differ.');
        return { ttfb, bytes: bytes.length, hit: response.headers.get('x-imageway-cache') };
      };
      const cold = await request();
      const warm = [];
      for (let i = 0; i < 30; i++) {
        const result = await request();
        if (result.hit !== 'HIT') throw new Error('Expected a warm cache hit.');
        warm.push(result.ttfb);
      }
      const start = performance.now();
      let index = 0;
      await Promise.all(
        Array.from({ length: 4 }, async () => {
          while (index++ < 100) await request();
        }),
      );
      const requestsPerSecond = 100000 / (performance.now() - start);
      const stats = await (await fetch(base + '/_bench/stats')).json();
      rows.push({
        pair,
        variant,
        coldTtfbMs: cold.ttfb,
        warmMedianTtfbMs: median(warm),
        requestsPerSecond,
        warmSamples: warm,
        outputDigest: expectedDigest!,
        outputBytes: cold.bytes,
        ...stats,
      });
    } finally {
      child.kill('SIGTERM');
      await exited;
    }
  }
}
await writeFile(
  'bench/results/runtime-comparison.json',
  JSON.stringify(
    {
      measuredAt: new Date().toISOString(),
      cpu: cpus()[0]?.model,
      baseline,
      baselineReference: process.env.IMAGEWAY_BENCH_BASELINE_REF,
      protocol:
        'Seven alternating baseline/current pairs, fresh Node servers with empty disk caches; same 640px WebP q75 source, first request, 30 warm repeats, 100-request burst at concurrency four. Every response checked byte-identical. Both services have their built-in cache; serial execution, server exit awaited.',
      rows,
    },
    null,
    2,
  ) + '\n',
);
for (const variant of ['before', 'after']) {
  const selected = rows.filter((r) => r.variant === variant);
  console.log(
    JSON.stringify({
      variant,
      coldTtfbMs: median(selected.map((r) => r.coldTtfbMs)),
      warmTtfbMs: median(selected.map((r) => r.warmMedianTtfbMs)),
      requestsPerSecond: median(selected.map((r) => r.requestsPerSecond)),
    }),
  );
}

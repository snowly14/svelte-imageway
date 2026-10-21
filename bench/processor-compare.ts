import { spawn } from 'node:child_process';
import { rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { cpus } from 'node:os';
const baseline = process.argv[2];
if (!baseline)
  throw new Error('Pass baseline dist/node/processor.js; run bench:build first for fixtures.');
const cases = [
  { name: 'small-webp', file: 'chart.png', format: 'webp', iterations: 5000 },
  { name: 'photo-webp', file: 'texture.jpg', format: 'webp', iterations: 500 },
  { name: 'large-png', file: 'landscape.png', format: 'png', iterations: 250 },
];
const rows: Array<Record<string, unknown>> = [];
const digests = new Map<string, string>();
for (let pair = 0; pair < 7; pair++)
  for (const test of cases)
    for (const variant of pair % 2 ? ['after', 'before'] : ['before', 'after']) {
      const directory = resolve('.local/bench/processor-' + variant);
      await rm(directory, { recursive: true, force: true });
      const modulePath =
        variant === 'before'
          ? resolve(baseline)
          : resolve('packages/svelte-imageway/dist/node/processor.js');
      const row = await new Promise<Record<string, unknown>>((done, reject) => {
        const child = spawn('node', [
          'bench/processor-child.ts',
          modulePath,
          resolve('.local/bench/fixtures', test.file),
          test.format,
          String(test.iterations),
          directory,
        ]);
        let stdout = '',
          stderr = '';
        const timer = setTimeout(() => {
          child.kill('SIGTERM');
          reject(new Error('Processor benchmark deadline exceeded'));
        }, 60000);
        child.stdout.on('data', (b) => (stdout += b));
        child.stderr.on('data', (b) => (stderr += b));
        child.once('error', (e) => {
          clearTimeout(timer);
          reject(e);
        });
        child.once('exit', (code) => {
          clearTimeout(timer);
          if (code) reject(new Error(stderr + stdout));
          else
            try {
              done(JSON.parse(stdout.trim().split('\n').at(-1)!));
            } catch (e) {
              reject(e);
            }
        });
      });
      const digest = String(row.outputDigest);
      if (digests.has(test.name) && digests.get(test.name) !== digest)
        throw new Error('Encoded outputs differ');
      digests.set(test.name, digest);
      rows.push({ pair, case: test.name, variant, ...row });
    }
await writeFile(
  'bench/results/processor-comparison.json',
  JSON.stringify(
    {
      measuredAt: new Date().toISOString(),
      cpu: cpus()[0]?.model,
      baseline,
      baselineReference: process.env.IMAGEWAY_BENCH_BASELINE_REF,
      protocol:
        'Seven alternating baseline/current pairs per case; fresh Node processes and empty disk cache per child. Native first transform and 20 warm-ups excluded. Sequential prepared-source cache hits, default memory budget, no HTTP; same 960px q75 outputs verified byte-identical. Original synthetic fixtures. Serial benchmark workload; host load uncontrolled.',
      rows,
    },
    null,
    2,
  ) + '\n',
);
const median = (a: number[]) => a.sort((a, b) => a - b)[Math.floor(a.length / 2)];
for (const test of cases)
  for (const variant of ['before', 'after']) {
    const selected = rows.filter((r) => r.case === test.name && r.variant === variant);
    console.log(
      JSON.stringify({
        case: test.name,
        variant,
        operationsPerSecond: median(selected.map((r) => Number(r.operationsPerSecond))),
        peakRssBytes: median(selected.map((r) => Number(r.peakRssBytes))),
      }),
    );
  }

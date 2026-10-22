import { spawn } from 'node:child_process';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { cpus } from 'node:os';
const baseline = process.argv[2];
if (!baseline)
  throw new Error(
    'Pass the baseline dist/vite/index.js path. Run bench:build first to prepare fixtures.',
  );
const root = resolve('.local/bench-paired');
await mkdir(root, { recursive: true });
const rows: Record<string, unknown>[] = [];
const signatures = new Map<string, string>();
for (let pair = 0; pair < 7; pair++) {
  for (const variant of pair % 2 ? ['after', 'before'] : ['before', 'after']) {
    const directory = join(root, variant);
    await mkdir(directory, { recursive: true });
    await cp('.local/bench/fixtures', directory, { recursive: true });
    await writeFile(
      join(directory, 'index.html'),
      '<script type="module" src="/main.js"></script>',
    );
    await writeFile(
      join(directory, 'main.js'),
      ['landscape.png', 'texture.jpg', 'chart.png']
        .map(
          (file, i) =>
            `import p${i} from './${file}?w=320;640;960&format=webp;jpg&q=75&placeholder=none&img'; console.log(p${i});`,
        )
        .join('\n'),
    );
    await rm(join(directory, 'node_modules/.cache'), { recursive: true, force: true });
    for (const cache of ['cold', 'warm']) {
      const row = await new Promise<Record<string, unknown>>((done, reject) => {
        const child = spawn('node', [resolve('bench/build.ts'), 'imageway', directory], {
          cwd: directory,
          env: {
            ...process.env,
            IMAGEWAY_BENCH_PLUGIN: variant === 'before' ? resolve(baseline) : '',
          },
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        let out = '',
          err = '';
        child.stdout.on('data', (b) => (out += b));
        child.stderr.on('data', (b) => (err += b));
        child.on('error', reject);
        child.on('exit', (code) => {
          if (code) reject(new Error(err + out));
          else {
            try {
              done(JSON.parse(out.trim().split('\n').at(-1)!));
            } catch (e) {
              reject(e);
            }
          }
        });
      });
      rows.push({ pair, variant, cache, ...row });
      const files = (await readdir(join(directory, 'dist/imageway'))).sort();
      const digest = createHash('sha256');
      for (const file of files)
        digest.update(await readFile(join(directory, 'dist/imageway', file)));
      const signature = digest.digest('hex');
      signatures.set(`${variant}-${pair}-${cache}`, signature);
      if (new Set(signatures.values()).size > 1)
        throw new Error('Encoded outputs differ; timing comparison cannot claim identical work.');
    }
  }
}
const report = {
  measuredAt: new Date().toISOString(),
  cpu: cpus()[0]?.model,
  baseline,
  baselineReference: process.env.IMAGEWAY_BENCH_BASELINE_REF,
  protocol:
    'Seven alternating before/after pairs; fresh Node process per build; cold disk reset before each pair, warm repeat; identical directives/codecs and byte-identical image outputs. No concurrent benchmark workload.',
  imageOutputsIdentical: true,
  rows,
};
await writeFile('bench/results/comparison.json', JSON.stringify(report, null, 2) + '\n');
for (const variant of ['before', 'after'])
  for (const cache of ['cold', 'warm']) {
    const selected = rows.filter((r) => r.variant === variant && r.cache === cache);
    const durations = selected.map((r) => Number(r.durationMs)).sort((a, b) => a - b);
    console.log(
      JSON.stringify({
        variant,
        cache,
        medianMs: durations[3],
        minMs: durations[0],
        maxMs: durations[6],
        samples: 7,
      }),
    );
  }

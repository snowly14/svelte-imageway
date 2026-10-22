import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import { cpus, platform, arch } from 'node:os';
const exec = promisify(execFile);
const baseline = process.argv[2];
if (!baseline) throw Error('Pass the published 2.0.0 dist/vite/placeholder.js baseline path.');
const samples: Record<string, unknown>[] = [];
const median = (values: number[]) =>
  values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)]!;
const suites = [
  { fixtures: ['square', 'landscape', 'tiny'], modes: ['reference', 'optimizedJS', 'rust'] },
  { fixtures: ['square', 'landscape'], modes: ['pipeline-baseline', 'pipeline-current'] },
];
for (const suite of suites)
  for (const fixture of suite.fixtures)
    for (let pair = 0; pair < 7; pair++)
      for (const mode of pair % 2 ? [...suite.modes].reverse() : suite.modes) {
        const result = await exec('node', ['bench/preview-child.ts', mode, fixture, baseline], {
          maxBuffer: 100000,
        });
        samples.push({ ...JSON.parse(result.stdout), pair });
      }
const summaries = [];
for (const suite of suites)
  for (const fixture of suite.fixtures) {
    const rows = samples.filter(
      (s) => s.fixture === fixture && suite.modes.includes(s.mode as string),
    );
    if (new Set(rows.map((s) => s.digest)).size !== 1)
      throw Error('Preview output differs between candidates.');
    summaries.push({
      fixture,
      modes: Object.fromEntries(
        suite.modes.map((mode) => [
          mode,
          {
            medianMs: median(
              rows.filter((s) => s.mode === mode).map((s) => s.perOperationMs as number),
            ),
            firstOperationMedianMs: median(
              rows.filter((s) => s.mode === mode).map((s) => s.firstOperationMs as number),
            ),
            initializationMedianMs: median(
              rows.filter((s) => s.mode === mode).map((s) => s.initializedMs as number),
            ),
          },
        ]),
      ),
    });
  }
const report = {
  measuredAt: new Date().toISOString(),
  packageVersion: JSON.parse(await readFile('packages/svelte-imageway/package.json', 'utf8'))
    .version,
  node: (await exec('node', ['--version'])).stdout.trim(),
  platform: platform(),
  arch: arch(),
  cpu: cpus()[0]?.model,
  baseline,
  protocol:
    'Seven alternating fresh-process sets; 25 warm-ups; full 4x3 encode plus packing includes host/WASM copies; kernel 2000 operations, complete preview 30. Initialization reported separately. Output digests must match. Host load uncontrolled. Applies only to optional blurhash previews, not JPEG/WebP encoding, default LQIP, browser delivery or HTTP throughput.',
  summaries,
  samples,
};
await writeFile('bench/results/preview-rust.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(summaries, null, 2));

import { readFile, writeFile, rm, mkdir, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { execute, digest, environment } from '../photographic/common.ts';

const directory = resolve('.local/sparse-colour/profiles');
await mkdir(directory, { recursive: true });
const rows = [];
for (const workers of [1, 4]) {
  const root = resolve(
    '.local/sparse-colour/work/baseline/photographic',
    workers === 1 ? 'one' : 'four',
  );
  await rm(join(root, 'node_modules/.cache'), { recursive: true, force: true });
  const trace = join(directory, `workers-${workers}.jsonl`);
  await writeFile(trace, '');
  const { stdout } = await execute(
    'node',
    [
      '--import',
      resolve('bench/build-workers/trace.mjs'),
      '--cpu-prof',
      `--cpu-prof-dir=${directory}`,
      `--cpu-prof-name=workers-${workers}.cpuprofile`,
      resolve('bench/build-workers/child.ts'),
      'imageway',
      root,
      resolve('.local/component-3.1.8/baseline/package'),
      String(workers),
    ],
    { env: { ...process.env, IMAGEWAY_TRACE_FILE: trace }, timeout: 300000 },
  );
  const bytes = await readFile(trace);
  const events = bytes
    .toString()
    .trim()
    .split('\n')
    .map(
      (line) =>
        JSON.parse(line) as {
          threadId: number;
          method: string;
          started: number;
          elapsedMs?: number;
          inputBytes?: number;
        },
    );
  const profile = await readFile(join(directory, `workers-${workers}.cpuprofile`));
  const cpu = JSON.parse(profile.toString()) as {
    nodes: Array<{ id: number; callFrame: { functionName: string; url: string } }>;
    samples: number[];
    timeDeltas: number[];
  };
  const own = new Map<number, number>();
  cpu.samples.forEach((id, i) => own.set(id, (own.get(id) ?? 0) + cpu.timeDeltas[i]!));
  rows.push({
    workers,
    diagnosticBuild: JSON.parse(stdout.trim()),
    events,
    traceSha256: digest(bytes),
    profileSha256: digest(profile),
    methods: [...new Set(events.map((e) => e.method))].map((method) => {
      const selected = events.filter((e) => e.method === method);
      return {
        method,
        calls: selected.length,
        inputBytes: selected.reduce((sum, e) => sum + (e.inputBytes ?? 0), 0),
        summedAsyncMs: selected.reduce((sum, e) => sum + (e.elapsedMs ?? 0), 0),
      };
    }),
    topMainThreadSamples: cpu.nodes
      .map((node) => ({ ...node.callFrame, sampledMs: (own.get(node.id) ?? 0) / 1000 }))
      .sort((a, b) => b.sampledMs - a.sampledMs)
      .slice(0, 20),
  });
}
await writeFile(
  'bench/results/sparse-colour-3.1.8/diagnostics.json',
  JSON.stringify(
    {
      environment: await environment(),
      protocol:
        'Untimed diagnostic only; main-thread V8 samples exclude native libvips execution. Sharp metadata/toBuffer/stats promise durations include async overlap and preload/log overhead: do not add them to infer wall-clock CPU or attribute native time to decoding vs encoding. Worker --import runs outside timed studies. Trace records operation count and encoded input bytes submitted; copies are not inferred from elapsed time. Full local CPU profiles retained by digest. No diagnostic values enter benchmark medians.',
      files: await readdir(directory),
      rows,
    },
    null,
    2,
  ) + '\n',
);
console.log(rows.map(({ workers, methods }) => ({ workers, methods })));

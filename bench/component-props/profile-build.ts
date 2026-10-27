import { readFile, writeFile, rm, mkdir, readdir } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { execute, digest, environment } from '../photographic/common.ts';

const argument = (key: string) =>
  process.argv.find((v) => v.startsWith(key + '='))?.slice(key.length + 1);
const directory = resolve(argument('--trace-dir') ?? '.local/sparse-colour/profiles');
const output = resolve(
  argument('--output') ?? 'bench/results/sparse-colour-3.1.8/diagnostics.json',
);
const packageRoot = resolve(argument('--candidate') ?? '.local/component-3.1.8/baseline/package');
try {
  await readFile(output);
  throw Error('Preserve existing diagnostics; choose a fresh --output and --trace-dir.');
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}
await mkdir(directory, { recursive: true });
if ((await readdir(directory)).length)
  throw Error('Preserve existing CPU profiles; choose an empty --trace-dir.');
await mkdir(dirname(output), { recursive: true });
const rows = [];
for (const workers of [1, 4]) {
  const root = resolve(
    '.local/sparse-colour/work/baseline/photographic',
    workers === 1 ? 'one' : 'four',
  );
  await rm(join(root, 'node_modules/.cache'), { recursive: true, force: true });
  const profileDirectory = join(directory, `concurrency-${workers}`);
  await mkdir(profileDirectory);
  const trace = join(profileDirectory, 'trace.jsonl');
  await writeFile(trace, '');
  const { stdout } = await execute(
    'node',
    [
      '--import',
      resolve('bench/build-workers/trace.mjs'),
      '--cpu-prof',
      `--cpu-prof-dir=${profileDirectory}`,
      resolve('bench/build-workers/child.ts'),
      'imageway',
      root,
      packageRoot,
      String(workers),
    ],
    { cwd: root, env: { ...process.env, IMAGEWAY_TRACE_FILE: trace }, timeout: 300000 },
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
  // Node's default name contains pid/threadId/sequence. A shared explicit name
  // lets worker exits overwrite each other's profiles, losing diagnostic evidence.
  const profiles = (await readdir(profileDirectory)).filter((name) => name.endsWith('.cpuprofile'));
  const main = profiles.filter((name) => name.split('.').at(-3) === '0');
  if (main.length !== 1) throw Error('Cannot identify exactly one main-thread CPU profile.');
  const profile = await readFile(join(profileDirectory, main[0]!));
  const profileFiles = await Promise.all(
    profiles.map(async (name) => ({
      name,
      sha256: digest(await readFile(join(profileDirectory, name))),
    })),
  );
  const cpu = JSON.parse(profile.toString()) as {
    nodes: Array<{ id: number; callFrame: { functionName: string; url: string } }>;
    samples: number[];
    timeDeltas: number[];
  };
  const own = new Map<number, number>();
  cpu.samples.forEach((id, i) => own.set(id, (own.get(id) ?? 0) + cpu.timeDeltas[i]!));
  rows.push({
    logicalConcurrency: workers,
    packageRoot,
    mainThreadProfile: main[0],
    profileFiles,
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
  output,
  JSON.stringify(
    {
      environment: await environment(),
      protocol:
        'Untimed diagnostic only; unique default CPU filenames preserve every worker profile and explicitly select thread0. Original shared-name files remain archived; observed originals contain main Vite frames. Main-thread V8 samples exclude native libvips execution. Sharp metadata/toBuffer/stats promise durations include async overlap and preload/log overhead: do not add them to infer wall-clock CPU or attribute native time to decoding vs encoding. Worker --import runs outside timed studies. Trace records operation count and encoded input bytes submitted; copies are not inferred from elapsed time. Full local CPU profiles retained by digest. No diagnostic values enter benchmark medians.',
      files: await readdir(directory),
      rows,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  rows.map(({ logicalConcurrency, methods, profileFiles }) => ({
    logicalConcurrency,
    methods,
    profileCount: profileFiles.length,
  })),
);

import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { execute, environment, digest } from '../photographic/common.ts';

// Diagnostic profiles only; profiler overhead is excluded from timed benchmark tables.
const rows = [];
for (const variant of ['before', 'after']) {
  const root = resolve('.local/perf-3.1/work/responsive', variant);
  const directory = resolve('.local/perf-3.1/profiles', variant);
  await mkdir(directory, { recursive: true });
  await rm(join(root, 'node_modules/.cache'), { recursive: true, force: true });
  await execute(
    'node',
    [
      '--cpu-prof',
      `--cpu-prof-dir=${directory}`,
      resolve('bench/improvements/child.ts'),
      'build',
      resolve(
        variant === 'before' ? '.local/perf-3.1/baseline/package' : 'packages/svelte-imageway',
      ),
      root,
      'responsive',
    ],
    { timeout: 300000 },
  );
  const name = (await readdir(directory)).find((name) => /\.0\.\d+\.cpuprofile$/.test(name));
  if (!name) throw Error('Main-thread CPU profile missing.');
  const bytes = await readFile(join(directory, name));
  const profile = JSON.parse(bytes.toString()) as {
    nodes: Array<{ id: number; callFrame: { functionName: string; url: string } }>;
    samples: number[];
    timeDeltas: number[];
  };
  const own = new Map<number, number>();
  profile.samples.forEach((id, i) => own.set(id, (own.get(id) ?? 0) + profile.timeDeltas[i]!));
  const modules = [...new Set(profile.nodes.map((node) => node.callFrame.url).filter(Boolean))];
  rows.push({
    variant,
    profile: name,
    sha256: digest(bytes),
    bytes: bytes.length,
    svgoModules: modules.filter((url) => /\/(?:svgo|css-tree)\//.test(url)).length,
    topSelfSamples: profile.nodes
      .map((node) => ({
        function: node.callFrame.functionName,
        module: node.callFrame.url.replaceAll(resolve('.') + '/', ''),
        sampledMs: (own.get(node.id) ?? 0) / 1000,
      }))
      .sort((a, b) => b.sampledMs - a.sampledMs)
      .slice(0, 20),
  });
}
await writeFile(
  'bench/results/improvements-3.1/profiles.json',
  JSON.stringify(
    {
      environment: await environment(),
      protocol:
        'One untimed --cpu-prof diagnostic per version, controlled photographic cold responsive workload; main-thread self-sample estimates only. Native libvips execution on other threads is not measured here. Full local profiles retained by SHA; regenerate with this script. Profiles run after timed suites, not concurrently.',
      rows,
    },
    null,
    2,
  ) + '\n',
);
console.log(JSON.stringify(rows, null, 2));

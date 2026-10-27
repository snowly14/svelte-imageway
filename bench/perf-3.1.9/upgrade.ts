import { cp, mkdir, readFile, readdir, rm, writeFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { digest, environment, execute, names, summary } from '../photographic/common.ts';
import { verifyCorpus } from '../lean-preview/corpus.ts';

const directory = resolve('bench/results/perf-3.1.9');
const study = process.argv.find((v) => v.startsWith('--study='))?.slice(8) ?? 'upgrade';
if (!/^[a-z-]+$/.test(study)) throw Error('Invalid study label.');
const candidate = resolve(
  process.argv.find((v) => v.startsWith('--candidate='))?.slice(12) ??
    '.local/component-3.1.9/candidate/package',
);
const expectReuse = process.argv.includes('--expect-reuse');
const output = join(directory, study + '.json');
try {
  await readFile(output);
  throw Error('Preserve existing upgrade results.');
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}
if (
  digest(await readFile('.local/release-3.1.8/svelte-imageway-3.1.8.tgz')) !==
  '7d4b09a7140a79204c4b4a77bf8fabecc81c8aecc7d16c09b016ce549efd9480'
)
  throw Error('Unexpected baseline.');
const inputs = await verifyCorpus();
const env = await environment();
type Result = {
  buildMs: number;
  peakRssBytes: number;
  assets: Array<{ bytes: number; sha256: string }>;
};
type Row = {
  round: number;
  stage: string;
  buildMs: number;
  processWallMs: number;
  peakRssBytes: number;
  assetDigest: string;
  assetCount: number;
  assetBytes: number;
  names: string[];
  transformCacheEntries: number;
  previewCacheEntries: number;
  transformCacheFingerprint: string;
  previewCacheFingerprint: string;
};
const rows: Row[] = [];
const stages = ['baseline-cold', 'baseline-warm', 'upgraded-first', 'upgraded-warm'];
async function snapshot(directory: string): Promise<{ count: number; fingerprint: string }> {
  const files: Array<{ name: string; size: string; mtimeNs: string }> = [];
  async function walk(root: string): Promise<void> {
    const entries = await readdir(root, { withFileTypes: true }).catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return [];
        throw error;
      },
    );
    for (const entry of entries) {
      const path = join(root, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) {
        const info = await stat(path, { bigint: true });
        files.push({
          name: path.slice(directory.length + 1),
          size: info.size.toString(),
          mtimeNs: info.mtimeNs.toString(),
        });
      }
    }
  }
  await walk(directory);
  files.sort((a, b) => a.name.localeCompare(b.name));
  return { count: files.length, fingerprint: digest(JSON.stringify(files)) };
}
if (expectReuse) {
  const previous = await readFile(
    '.local/component-3.1.9/baseline/package/dist/version.js',
    'utf8',
  );
  const actual = await readFile(join(candidate, 'dist/version.js'), 'utf8');
  const revision = /PIPELINE_REVISION\s*=\s*["']([a-f0-9]+)/;
  if (!revision.exec(previous) || revision.exec(previous)?.[1] !== revision.exec(actual)?.[1])
    throw Error('Candidate does not use baseline revision.');
  const selected = await readFile('.local/component-3.1.9/candidate/package/dist/node/pipeline.js');
  if (digest(selected) !== digest(await readFile(join(candidate, 'dist/node/pipeline.js'))))
    throw Error('Candidate processing bytes differ from selected.');
}

for (let round = 0; round < 7; round++) {
  const root = resolve('.local/component-3.1.9', study, `round-${round}`);
  await mkdir(root, { recursive: true });
  for (const name of names) await cp(join('.local/photographic/corpus', name), join(root, name));
  await writeFile(join(root, 'index.html'), '<script type="module" src="/main.js"></script>');
  await writeFile(
    join(root, 'main.js'),
    names.map((name, i) => `import p${i} from './${name}';console.log(p${i});`).join('\n'),
  );
  await rm(join(root, 'node_modules/.cache'), { recursive: true, force: true });
  let expected: string | undefined;
  for (const stage of stages) {
    const pkg = resolve(
      stage.startsWith('baseline') ? '.local/component-3.1.9/baseline/package' : candidate,
    );
    const started = performance.now();
    const { stdout } = await execute(
      'node',
      [resolve('bench/improvements/child.ts'), 'build', pkg, root, 'automatic'],
      { cwd: root, timeout: 300000, maxBuffer: 2000000 },
    );
    const wall = performance.now() - started;
    const result = JSON.parse(stdout.trim()) as Result;
    const assetDigest = digest(JSON.stringify(result.assets));
    expected ??= assetDigest;
    if (assetDigest !== expected || result.assets.length !== 156)
      throw Error('Upgrade output byte identity failed.');
    const files = (await readdir(join(root, 'dist/imageway'))).toSorted();
    const cache = join(root, 'node_modules/.cache');
    const transformCache = await snapshot(join(cache, 'svelte-imageway'));
    const previewCache = await snapshot(join(cache, 'svelte-imageway-previews'));
    if (expectReuse && stage === 'upgraded-first') {
      const prior = rows.find((r) => r.round === round && r.stage === 'baseline-warm')!;
      if (
        prior.transformCacheFingerprint !== transformCache.fingerprint ||
        prior.previewCacheFingerprint !== previewCache.fingerprint ||
        JSON.stringify(prior.names) !== JSON.stringify(files)
      )
        throw Error('Upgrade changed cache files or asset URLs.');
    }
    rows.push({
      round,
      stage,
      buildMs: result.buildMs,
      processWallMs: wall,
      peakRssBytes: result.peakRssBytes,
      assetDigest,
      assetCount: result.assets.length,
      assetBytes: result.assets.reduce((n, a) => n + a.bytes, 0),
      names: files,
      transformCacheEntries: transformCache.count,
      previewCacheEntries: previewCache.count,
      transformCacheFingerprint: transformCache.fingerprint,
      previewCacheFingerprint: previewCache.fingerprint,
    });
    await writeFile(
      output,
      JSON.stringify(
        {
          complete: rows.length === 28,
          environment: env,
          candidateRoot: candidate,
          expectReuse,
          inputs,
          protocol:
            'Seven sequential upgrade trials, each uses a fresh isolated Vite root and shared on-disk caches within its four fresh Node processes: 3.1.8 cold, 3.1.8 warm, selected 3.1.9 pipeline first build without clearing caches, then selected pipeline warm. All 24 Kodak photos use ordinary imports with default multi-format settings. Image-byte/SHA multisets must match. Collect actual output filenames and cache entry counts after each build. OS caches unflushed, serial suites; this measures a version transition, not normal warm performance or cloud deployment.',
          rows,
        },
        null,
        2,
      ) + '\n',
    );
    console.log(
      `${round + 1}/7 ${stage}: ${result.buildMs.toFixed(1)}ms ${(result.peakRssBytes / 1048576).toFixed(1)}MiB`,
    );
  }
}
await writeFile(
  join(directory, study + '-summary.json'),
  JSON.stringify(
    stages.map((stage) => {
      const r = rows.filter((row) => row.stage === stage);
      return {
        stage,
        buildMs: summary(r.map((x) => x.buildMs)),
        peakRssMiB: summary(r.map((x) => x.peakRssBytes / 1048576)),
        transformCacheEntries: summary(r.map((x) => x.transformCacheEntries)),
        previewCacheEntries: summary(r.map((x) => x.previewCacheEntries)),
      };
    }),
    null,
    2,
  ) + '\n',
);

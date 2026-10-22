import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { execute, root, corpus, names, save, summary, environment } from './common.ts';

interface BuildResult {
  engine: string;
  buildMs: number;
  peakRssBytes: number;
  assets: Array<{ file: string; bytes: number; sha256: string }>;
  node: string;
}
export async function builds() {
  const engines = ['imageway', 'imagetools', 'enhanced-img', 'imageway-control'];
  const rows: Array<BuildResult & { round: number; cache: string; processWallMs: number }> = [];
  let expected: string | undefined;
  const env = await environment();
  for (const engine of [...engines, 'imageway-auto']) {
    const dir = join(root, engine);
    await mkdir(dir, { recursive: true });
    for (const name of names) await cp(join(corpus, name), join(dir, name));
    await writeFile(join(dir, 'index.html'), '<script type="module" src="/main.js"></script>');
    const query =
      engine === 'imageway-auto'
        ? ''
        : engine.startsWith('imageway')
          ? '?img&w=256;384;512&format=webp&q=75&placeholder=none'
          : `?${engine === 'enhanced-img' ? 'enhanced&' : ''}w=256;384;512&format=webp&quality=75&as=picture`;
    await writeFile(
      join(dir, 'main.js'),
      names
        .map((name, i) => `import p${i} from './${name}${query}';console.log(p${i});`)
        .join('\n'),
    );
  }
  for (let round = 0; round < 7; round++) {
    const rotated = [
      ...engines.slice(round % engines.length),
      ...engines.slice(0, round % engines.length),
    ];
    const order = round % 2 ? rotated.reverse() : rotated;
    // Default auto imports have a different workload and are reported separately (three rounds).
    if (round < 3) order.push('imageway-auto');
    for (const engine of order) {
      const dir = join(root, engine);
      await rm(join(dir, 'node_modules/.cache'), { recursive: true, force: true });
      for (const cache of ['cold', 'warm']) {
        const started = performance.now();
        const { stdout } = await execute(
          'node',
          [resolve('bench/photographic/build-child.ts'), engine, dir],
          { cwd: dir, maxBuffer: 4_000_000, timeout: 300000 },
        );
        const processWallMs = performance.now() - started;
        const result = JSON.parse(stdout.trim().split('\n').at(-1)!) as BuildResult;
        if (engine !== 'imageway-auto') {
          if (result.assets.length !== 72)
            throw Error(`Expected 72 outputs: ${engine} ${result.assets.length}`);
          const actual = JSON.stringify(
            result.assets.map(({ bytes, sha256 }) => ({ bytes, sha256 })),
          );
          expected ??= actual;
          if (actual !== expected)
            throw Error(`Byte-identical output gate failed: ${engine}, ${cache}, ${round}`);
        }
        rows.push({ ...result, round, cache, processWallMs });
        await save('build', {
          environment: env,
          protocol:
            'Seven interleaved fresh-Node rounds; each cold build deletes tool disk cache; immediate warm build keeps cache. 24 Kodak PNGs, 256/384/512px, WebP q75, no preview. Every output SHA-256 multiset must match across all tools and cache states. imageway-control is identical source A/A. Default automatic imports are a separate three-round workload. buildMs includes candidate module loading, Vite build and emitted assets; processWallMs additionally includes process startup and post-build validation. Native/thread concurrency uses each tool default; not normalized. Node/libvips versions shared.',
          rows,
        });
        console.log(
          `build ${round + 1}/7 ${engine} ${cache}: ${result.buildMs.toFixed(1)}ms, ${result.assets.length} images`,
        );
      }
    }
  }
  const summaries = [...engines, 'imageway-auto'].flatMap((engine) =>
    ['cold', 'warm'].map((cache) => {
      const selected = rows.filter((r) => r.engine === engine && r.cache === cache);
      return {
        engine,
        cache,
        buildMs: summary(selected.map((r) => r.buildMs)),
        processWallMs: summary(selected.map((r) => r.processWallMs)),
        peakRssBytes: summary(selected.map((r) => r.peakRssBytes)),
        imageFiles: selected[0]!.assets.length,
        imageBytes: selected[0]!.assets.reduce((total, a) => total + a.bytes, 0),
      };
    }),
  );
  await save('build-summary', summaries);
  return summaries;
}

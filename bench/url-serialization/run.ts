import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { digest, environment, execute, summary } from '../photographic/common.ts';
const directory = 'bench/results/url-serialization-3.1.6';
await mkdir(directory, { recursive: true });
const study = process.argv[2] ?? 'initial';
if (!/^[a-z-]+$/.test(study)) throw Error('Invalid study name.');
const output = directory + (study === 'initial' ? '/measurements.json' : '/' + study + '.json');
try {
  await readFile(output);
  throw Error('Preserve earlier results.');
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
}
if (
  digest(await readFile('.local/release-3.1.5/svelte-imageway-3.1.5.tgz')) !==
  '09b1a5257093f31a32bb9ebfde22e3b61dd77cc16d6c1268c9cf68cd4a233841'
)
  throw Error('Unexpected baseline.');
const env = await environment();
const selection = study === 'selection';
const modes = selection
  ? ['provider', 'processor']
  : ['normalized', 'escaped', 'normalize', 'provider', 'processor'];
const rows: Array<{
  mode: string;
  variant: string;
  round: number;
  perOperationMs: number;
  cpuMicrosecondsPerOperation: number;
  outputDigest: string;
  peakRssBytes: number;
  outputBytes?: number;
}> = [];
for (let round = 0; round < 7; round++) {
  const order = [...modes.slice(round % modes.length), ...modes.slice(0, round % modes.length)];
  if (round % 2) order.reverse();
  for (const mode of order) {
    const variants = selection
      ? ['before', 'after', 'map-package']
      : ['normalized', 'escaped'].includes(mode)
        ? ['before', 'after', 'map-fast', 'loop-native']
        : ['before', 'after'];
    if (round % 2) variants.reverse();
    for (const variant of variants) {
      const cache = resolve('.local/url-3.1.6/cache', mode, variant);
      if (mode === 'processor') await rm(cache, { recursive: true, force: true });
      const { stdout } = await execute(
        'node',
        [
          resolve('bench/url-serialization/child.ts'),
          resolve(
            variant === 'before'
              ? '.local/url-3.1.6/baseline/package'
              : variant === 'map-package'
                ? '.local/url-3.1.6/map-fast-package'
                : 'packages/svelte-imageway',
          ),
          mode,
          ['map-fast', 'loop-native'].includes(variant) ? variant : '',
          cache,
        ],
        { timeout: 300000, maxBuffer: 1000000 },
      );
      const row = JSON.parse(stdout.trim()) as (typeof rows)[number];
      const previous = rows.find((r) => r.mode === mode);
      if (previous && row.outputDigest !== previous.outputDigest)
        throw Error('Full output identity failed: ' + mode + '/' + variant);
      rows.push({ ...row, mode, variant, round });
      await writeFile(
        output,
        JSON.stringify(
          {
            complete: rows.length === (selection ? 42 : 98),
            study,
            environment: env,
            baselineVersion: '3.1.5',
            protocol:
              'Seven rotated/reversed fresh-Node rounds, alternating variant order, all suites serial; OS caches unflushed.24inputs prepared outside timing;100warm batches. Query:5000batches/120000calls;normalize/provider:2000batches/48000calls. Query loops consume string length; object modes include full JSON serialization for every result. First batches/import setup separate. Processor: one real960pxWebP transform and50warm hits excluded,5000sequential prepared-source memory hits, default copy/limits, consume bytes. All complete outputs/digests identical per mode. map-fast isolates ASCII check with old array pipeline; loop-native isolates traversal with old native encoder. CPU usage supplements wall time under host load; neither is browser/HTTP/codec throughput.',
            rows,
          },
          null,
          2,
        ) + '\n',
      );
      console.log(`${round + 1}/7 ${mode} ${variant}: ${(row.perOperationMs * 1000).toFixed(3)}us`);
    }
  }
}
await writeFile(
  directory + (study === 'initial' ? '/summary.json' : '/' + study + '-summary.json'),
  JSON.stringify(
    modes.flatMap((mode) =>
      [...new Set(rows.filter((r) => r.mode === mode).map((r) => r.variant))].map((variant) => {
        const selected = rows.filter((r) => r.mode === mode && r.variant === variant);
        return {
          mode,
          variant,
          microseconds: summary(selected.map((r) => r.perOperationMs * 1000)),
          cpuMicroseconds: summary(selected.map((r) => r.cpuMicrosecondsPerOperation)),
          peakRssMiB: summary(selected.map((r) => r.peakRssBytes / 1048576)),
          outputBytes: selected[0]!.outputBytes,
        };
      }),
    ),
    null,
    2,
  ) + '\n',
);

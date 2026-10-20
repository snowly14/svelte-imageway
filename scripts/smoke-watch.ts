import { spawn } from 'node:child_process';
import { mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import sharp from 'sharp';
const root = resolve('.local/watch-smoke');
await rm(root, { recursive: true, force: true });
await mkdir(root, { recursive: true });
const source = join(root, 'source.png');
const image = (background: string) =>
  sharp({ create: { width: 64, height: 32, channels: 3, background } })
    .png()
    .toBuffer();
await writeFile(source, await image('red'));
const child = spawn(
  'node',
  [
    'packages/svelte-imageway/dist/cli/index.js',
    'optimize',
    root,
    '--width',
    '320',
    '--watch',
    '--json',
  ],
  { stdio: ['ignore', 'pipe', 'pipe'] },
);
let output = '';
child.stdout.on('data', (v) => (output += v));
child.stderr.on('data', (v) => (output += v));
async function report(previous?: string) {
  for (let i = 0; i < 100; i++) {
    try {
      const value = JSON.parse(
        await readFile(join(root, 'imageway-output/optimization-report.json'), 'utf8'),
      );
      if (value.entries[0]?.output && value.entries[0].output !== previous) return value;
    } catch {
      /* Initial write or atomic watcher iteration pending. */
    }
    if (child.exitCode !== null) throw new Error('Watch exited early: ' + output);
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Watch did not produce changed output: ' + output);
}
try {
  const first = await report();
  // Let the CLI attach the watcher after its initial batch report.
  await new Promise((r) => setTimeout(r, 300));
  await writeFile(source, await image('blue'));
  const second = await report(first.entries[0].output);
  const result = {
    changed: first.entries[0].output !== second.entries[0].output,
    preservedOriginal: (await readFile(source)).equals(await image('blue')),
    entries: second.entries.length,
  };
  if (!result.changed || !result.preservedOriginal || result.entries !== 1)
    throw new Error('Watch failed source/output isolation.');
  await writeFile('.local/watch-smoke.json', JSON.stringify(result, null, 2) + '\n');
  console.log(result);
} finally {
  child.kill('SIGTERM');
  await new Promise<void>((done) => {
    if (child.exitCode !== null) return done();
    child.once('exit', () => done());
    setTimeout(() => {
      child.kill('SIGKILL');
      done();
    }, 3000).unref();
  });
}

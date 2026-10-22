import { readFile, writeFile, mkdtemp, rm, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const exec = promisify(execFile);
const source = 'native/blurhash/lib.rs';
const artifact = 'packages/svelte-imageway/src/lib/node/blurhash.wasm';
const manifestPath = 'native/blurhash/manifest.json';
const sha = (value: Uint8Array) => createHash('sha256').update(value).digest('hex');
const sourceSha256 = sha(await readFile(source));
const rebuild = process.argv.includes('--rebuild');
if (rebuild || process.argv.includes('--verify')) {
  const compiler = (await exec('rustc', ['--version'])).stdout.trim();
  if (!compiler.startsWith('rustc 1.99.0 '))
    throw Error('Native rebuild requires Rust 1.99.0 and wasm32-unknown-unknown.');
  const directory = await mkdtemp(join(tmpdir(), 'imageway-rust-'));
  try {
    const output = join(directory, 'blurhash.wasm');
    await exec('rustc', [
      source,
      '--crate-type',
      'cdylib',
      '--edition',
      '2021',
      '--target',
      'wasm32-unknown-unknown',
      '-C',
      'opt-level=3',
      '-C',
      'panic=abort',
      '-C',
      'lto=fat',
      '-C',
      'strip=symbols',
      '-C',
      'link-arg=--initial-memory=65536',
      '-C',
      'link-arg=--max-memory=65536',
      '-C',
      'link-arg=-zstack-size=16384',
      '-o',
      output,
    ]);
    const bytes = await readFile(output);
    if (rebuild) {
      await copyFile(output, artifact);
      await writeFile(
        manifestPath,
        JSON.stringify(
          {
            compiler: 'rustc 1.99.0',
            target: 'wasm32-unknown-unknown',
            sourceSha256,
            wasmSha256: sha(bytes),
            bytes: bytes.length,
            memoryBytes: 65536,
          },
          null,
          2,
        ) + '\n',
      );
    } else if (!bytes.equals(await readFile(artifact)))
      throw Error('Recompiled Rust artifact differs from the committed WASM.');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
  sourceSha256: string;
  wasmSha256: string;
};
if (manifest.sourceSha256 !== sourceSha256 || manifest.wasmSha256 !== sha(await readFile(artifact)))
  throw Error('Rust source/artifact fingerprint mismatch; run bun run native:rebuild.');
console.log('Verified Rust BlurHash source and WASM artifact.');

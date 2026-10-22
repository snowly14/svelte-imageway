import { fileURLToPath } from 'node:url';
import { it, expect } from 'vitest';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { configureVite, init } from '../packages/svelte-imageway/src/lib/cli/init.js';
import { audit } from '../packages/svelte-imageway/src/lib/cli/audit.js';
import { migrate } from '../packages/svelte-imageway/src/lib/cli/migrate.js';
import { PACKAGE_VERSION } from '../packages/svelte-imageway/src/lib/version.js';
import sharp from 'sharp';

const cli = fileURLToPath(
  new URL('../packages/svelte-imageway/dist/cli/index.js', import.meta.url),
);
it('migrates legacy query ordering with backups and preserves encoded parameter boundaries', async () => {
  const root = await mkdtemp(join(tmpdir(), 'imageway-v1-'));
  try {
    const path = join(root, 'consumer.ts');
    const source = 'import image from "./photo.jpg?img&w=320;640&q=75%26w%3D1";';
    await writeFile(path, source);
    expect((await migrate(root, 'imageway-v1')).changed).toEqual(['consumer.ts']);
    expect(await readFile(path, 'utf8')).toBe(source);
    await migrate(root, 'imageway-v1', true);
    expect(await readFile(path, 'utf8')).toContain('photo.jpg?w=320%3B640&q=75%26w%3D1&img');
    expect(await readFile(path + '.imageway-backup', 'utf8')).toBe(source);
    expect((await migrate(root, 'imageway-v1')).changed).toEqual([]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
it('reports actual installed buffer codecs through the compiled CLI', () => {
  for (const runtime of ['node', 'bun']) {
    const report = JSON.parse(
      execFileSync(runtime, [cli, 'codecs', '--json'], { encoding: 'utf8' }),
    );
    expect(report.versions.vips).toBe(sharp.versions.vips);
    expect(report.formats.jxl).toEqual(sharp.format.jxl);
    expect(report.formats.webp.output.buffer).toBe(true);
  }
  expect(execFileSync('node', [cli, 'codecs'], { encoding: 'utf8' })).toContain('jxl: input=');
});
it('patches syntax once, preserves comments and other plugins, and refuses ambiguous configs', async () => {
  const before =
    "// keep me\nimport {sveltekit} from '@sveltejs/kit/vite';\nexport default defineConfig({plugins:[sveltekit()],server:{port:4000}});";
  const after = await configureVite(before);
  expect(after).toContain('plugins:[__imagewayPlugin(), sveltekit()]');
  expect(after).toContain('// keep me');
  expect(await configureVite(after)).toBe(after);
  await expect(configureVite('export default computedConfig;')).rejects.toThrow(/literal/);
});
it('executes the compiled CLI with Node, Bun and a bin symlink', async () => {
  const root = await mkdtemp(join(tmpdir(), 'imageway-cli-'));
  try {
    await symlink(cli, join(root, 'imageway'));
    for (const runtime of ['node', 'bun']) {
      expect(execFileSync(runtime, [cli, '--version'], { encoding: 'utf8' }).trim()).toBe(
        PACKAGE_VERSION,
      );
      expect(
        execFileSync(runtime, [join(root, 'imageway'), '--help'], { encoding: 'utf8' }),
      ).toContain('optimize');
    }
    expect(() => execFileSync('node', [cli, 'unknown'], { stdio: 'pipe' })).toThrow();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
it('initializes idempotently, audits actual Svelte syntax and generates deployment without overwrites', async () => {
  const root = await mkdtemp(join(tmpdir(), 'imageway-init-'));
  try {
    await writeFile(join(root, 'package.json'), '{}');
    await writeFile(join(root, 'vite.config.ts'), 'export default {plugins: []};');
    expect((await init(root, true)).changed).toContain('vite.config.ts');
    expect(await readFile(join(root, 'vite.config.ts'), 'utf8')).not.toContain('imagewayPlugin');
    await init(root);
    expect((await init(root)).changed).toEqual([]);
    await writeFile(join(root, 'src/Bad.svelte'), '<img src="/a.png">');
    expect((await audit(root)).map((v) => v.code)).toEqual(
      expect.arrayContaining(['ALT', 'WIDTH', 'HEIGHT', 'LOADING', 'LCP_REVIEW']),
    );
    execFileSync('node', [cli, 'deploy', 'cloudflare', '--output', 'deploy'], { cwd: root });
    const config = await readFile(join(root, 'deploy/wrangler.toml'), 'utf8');
    expect(config).toContain('PUBLIC_SOURCES = "false"');
    await writeFile(join(root, 'deploy/worker.ts'), 'user changes');
    execFileSync('node', [cli, 'deploy', 'cloudflare', '--output', 'deploy'], { cwd: root });
    expect(await readFile(join(root, 'deploy/worker.ts'), 'utf8')).toBe('user changes');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
it('batch dry-run preserves sources; real output decodes and never overwrites an input', async () => {
  const module = new URL('../packages/svelte-imageway/dist/cli/optimize.js', import.meta.url);
  const { optimizeDirectory } = await import(module.href);
  const root = await mkdtemp(join(tmpdir(), 'imageway-opt-'));
  try {
    const sharp = (await import('sharp')).default;
    const original = await sharp({
      create: { width: 640, height: 400, channels: 3, background: 'blue' },
    })
      .png()
      .toBuffer();
    await writeFile(join(root, 'a.png'), original);
    const dry = await optimizeDirectory(root, { dryRun: true });
    expect(dry.entries[0]?.output).toBeUndefined();
    const result = await optimizeDirectory(root, { width: 320 });
    expect(
      (await sharp(await readFile(join(result.output, result.entries[0]!.output!))).metadata())
        .width,
    ).toBe(320);
    expect(await readFile(join(root, 'a.png'))).toEqual(original);
    expect((await optimizeDirectory(root, { dryRun: true })).entries).toHaveLength(1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
it('migrates supported static enhanced markup/imports with backup and leaves ambiguous directives for review', async () => {
  const root = await mkdtemp(join(tmpdir(), 'imageway-migrate-'));
  try {
    await mkdir(join(root, 'src'));
    const source =
      '<script lang="ts">\nimport hero from "./hero.jpg?enhanced&w=640";\n</script>\n<enhanced:img src={hero} alt="Hero" />\n<enhanced:img src="./a.png" alt="Static" />';
    const path = join(root, 'src/Hero.svelte');
    await writeFile(path, source);
    expect((await migrate(root, 'enhanced-img')).changed).toEqual(['src/Hero.svelte']);
    expect(await readFile(path, 'utf8')).toBe(source);
    await migrate(root, 'enhanced-img', true);
    const output = await readFile(path, 'utf8');
    expect(output).toContain('hero.jpg?w=640&img');
    expect(output).toContain('<ImagewayImageAlias src={hero}');
    expect(output).toContain('./a.png?img');
    expect(await readFile(path + '.imageway-backup', 'utf8')).toBe(source);
    const { parse } = await import('svelte/compiler');
    expect(() => parse(output, { modern: true })).not.toThrow();
    expect((await migrate(root, 'enhanced-img')).changed).toEqual([]);
    await writeFile(
      join(root, 'src/other.ts'),
      'import x from "./a.jpg?w=320&as=picture&unknown=1";',
    );
    expect((await migrate(root, 'imagetools')).review[0]).toContain('unsupported');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('optimizes nested keys and excludes a custom output subtree on every OS', async () => {
  const { optimizeDirectory } = await import('../packages/svelte-imageway/dist/cli/optimize.js');
  const root = await mkdtemp(join(tmpdir(), 'imageway-nested-'));
  try {
    const sharp = (await import('sharp')).default;
    const image = await sharp({ create: { width: 8, height: 8, channels: 3, background: 'red' } })
      .png()
      .toBuffer();
    await mkdir(join(root, 'nested'));
    await mkdir(join(root, 'custom-output'));
    await writeFile(join(root, 'nested/a.png'), image);
    await writeFile(join(root, 'custom-output/generated.png'), image);
    const report = await optimizeDirectory(root, {
      output: join(root, 'custom-output'),
      dryRun: true,
    });
    expect(report.entries.map((entry: { file: string }) => entry.file)).toEqual(['nested/a.png']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

import { spawn } from 'node:child_process';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { cpus, totalmem, platform, arch } from 'node:os';
import sharp from 'sharp';
const root = resolve('.local/bench');
await mkdir(root, { recursive: true });
const fixtures = join(root, 'fixtures');
await mkdir(fixtures, { recursive: true });
await copyFile('examples/components/src/landscape.png', join(fixtures, 'landscape.png'));
const w = 1200,
  h = 800,
  pixels = Buffer.alloc(w * h * 3);
let seed = 731;
for (let y = 0; y < h; y++)
  for (let x = 0; x < w; x++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const i = (y * w + x) * 3;
    pixels[i] = Math.min(255, (x / w) * 180 + (seed >>> 24) / 4);
    pixels[i + 1] = Math.min(255, (y / h) * 180 + (seed >>> 24) / 4);
    pixels[i + 2] = Math.min(255, 70 + 90 * Math.sin((x + y) / 100) + (seed >>> 24) / 5);
  }
await sharp(pixels, { raw: { width: w, height: h, channels: 3 } })
  .jpeg({ quality: 90 })
  .toFile(join(fixtures, 'texture.jpg'));
await sharp(
  Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#fffdf0"/><rect x="100" y="300" width="180" height="400" fill="#296454"/><rect x="400" y="200" width="180" height="500" fill="#8ea865"/><rect x="700" y="100" width="180" height="600" fill="#d2a16b"/></svg>',
  ),
)
  .png()
  .toFile(join(fixtures, 'chart.png'));
const names = ['landscape.png', 'texture.jpg', 'chart.png'];
const rows: Record<string, unknown>[] = [];
for (let run = 0; run < 3; run++)
  for (const engine of ['imageway', 'imagetools', 'enhanced-img']) {
    const dir = join(root, engine);
    await mkdir(dir, { recursive: true });
    for (const name of names) await copyFile(join(fixtures, name), join(dir, name));
    await writeFile(join(dir, 'index.html'), '<script type="module" src="/main.js"></script>');
    const directive =
      engine === 'imageway'
        ? 'img&w=320;640;960&format=webp;jpg&q=75&placeholder=none'
        : `${engine === 'enhanced-img' ? 'enhanced&' : ''}w=320;640;960&format=webp;jpg&q=75&as=picture`;
    await writeFile(
      join(dir, 'main.js'),
      names
        .map((name, i) => `import p${i} from './${name}?${directive}';console.log(p${i});`)
        .join('\n'),
    );
    await rm(join(dir, 'node_modules/.cache'), { recursive: true, force: true });
    // enhanced-img's official underlying plugin uses process cwd for its cache.
    const execute = () =>
      new Promise<Record<string, unknown>>((resolveRun, reject) => {
        const child = spawn('node', [resolve('bench/build.ts'), engine, dir], {
          cwd: dir,
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        let out = '',
          err = '';
        child.stdout.on('data', (b) => (out += b));
        child.stderr.on('data', (b) => (err += b));
        child.on('exit', (code) => {
          if (code) reject(new Error(err + out));
          else
            try {
              resolveRun(JSON.parse(out.trim().split('\n').at(-1)!));
            } catch (e) {
              reject(e);
            }
        });
      });
    rows.push({ run, cache: 'cold', ...(await execute()) });
    rows.push({ run, cache: 'warm', ...(await execute()) });
    await writeFile('bench/results/build.raw.json', JSON.stringify(rows, null, 2) + '\n');
  }
const weight = [];
for (const name of names) {
  const source = await readFile(join(fixtures, name));
  for (const format of ['webp', 'avif'] as const) {
    const bytes = await sharp(source)
      .resize({ width: 960, withoutEnlargement: true })
      .toFormat(format, { quality: 75 })
      .toBuffer();
    weight.push({
      file: name,
      format,
      inputBytes: source.length,
      outputBytes: bytes.length,
      reduction: 1 - bytes.length / source.length,
      width: (await sharp(bytes).metadata()).width,
    });
  }
}
const report = {
  measuredAt: new Date().toISOString(),
  environment: {
    platform: platform(),
    arch: arch(),
    cpu: cpus()[0]?.model,
    logicalCpu: cpus().length,
    memory: totalmem(),
    node: process.version,
    bun: process.versions.bun,
  },
  protocol:
    '3 synthetic opaque 1200x800 originals; 320/640/960; WebP+JPEG q75; 18 variants; placeholder=none where configurable; 3 cold/warm fresh Node processes per engine, cold deletes disk cache; tool-specific artifacts differ',
  rows,
  weight,
};
await writeFile('bench/results/build.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));

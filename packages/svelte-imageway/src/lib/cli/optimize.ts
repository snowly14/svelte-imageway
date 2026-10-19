import { mkdir, writeFile } from 'node:fs/promises';
import { relative, resolve, join } from 'node:path';
import { files } from './files.js';
import { readLocal } from '../node/source.js';
import { ImageProcessor } from '../node/processor.js';
import { hash } from '../node/cache.js';
import { mimeType } from '../core/accept.js';
import type { OutputFormat } from '../core/types.js';
import { invariant } from '../core/errors.js';
/** Batch optimization writes new immutable variants and never overwrites originals. */
export async function optimizeDirectory(
  root: string,
  options: {
    output?: string;
    width?: number;
    quality?: number;
    format?: string;
    dryRun?: boolean;
  } = {},
) {
  const output = resolve(options.output ?? join(root, 'imageway-output'));
  invariant(output !== root, 'OPTIMIZE_OUTPUT', 'Output directory must differ from source.');
  const format = options.format ?? 'webp';
  invariant(
    ['webp', 'avif', 'jpeg', 'png'].includes(format),
    'OPTIMIZE_FORMAT',
    'Use webp, avif, jpeg or png.',
  );
  const processor = new ImageProcessor({ directory: join(root, '.imageway/cache') });
  const entries: {
    file: string;
    inputBytes: number;
    outputBytes?: number;
    output?: string;
    type?: string;
  }[] = [];
  for (const path of await files(root, /\.(jpe?g|png|webp|avif|gif|tiff?|heic|heif|svg|jxl)$/i)) {
    if (path.startsWith(output + '/')) continue;
    const file = relative(root, path);
    const bytes = await readLocal(file, root);
    if (options.dryRun) {
      entries.push({ file, inputBytes: bytes.length });
      continue;
    }
    const result = await processor.process(
      bytes,
      { key: 'batch', w: options.width ?? 1920, q: options.quality ?? 75, animation: 'first' },
      format as OutputFormat,
    );
    const name = hash(result.data) + '.' + format;
    await mkdir(output, { recursive: true });
    await writeFile(join(output, name), result.data);
    entries.push({
      file,
      inputBytes: bytes.length,
      outputBytes: result.data.length,
      output: name,
      type: mimeType(format as OutputFormat),
    });
  }
  const report = {
    dryRun: Boolean(options.dryRun),
    output,
    entries,
    inputBytes: entries.reduce((n, v) => n + v.inputBytes, 0),
    outputBytes: entries.reduce((n, v) => n + (v.outputBytes ?? 0), 0),
  };
  if (!options.dryRun) {
    await mkdir(output, { recursive: true });
    await writeFile(
      join(output, 'optimization-report.json'),
      JSON.stringify(report, null, 2) + '\n',
    );
  }
  return report;
}

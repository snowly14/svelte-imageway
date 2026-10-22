import sharp from 'sharp';
import { ssim } from 'ssim.js';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { corpus, names, digest, environment, save, summary } from './common.ts';

export async function quality() {
  const env = await environment();
  const rows: Array<{
    file: string;
    codec: string;
    quality: number;
    bytes: number;
    referenceBytes: number;
    sha256: string;
    ssim: number;
    width: number;
    height: number;
  }> = [];
  const timings: Array<{ round: number; codec: string; quality: number; encodeMs: number }> = [];
  const codecs = ['jpeg-default', 'jpeg-mozjpeg', 'webp', 'avif'] as const;
  const qualities = [50, 65, 75, 85, 95];
  for (let round = 0; round < 3; round++) {
    const order = round % 2 ? [...codecs].reverse() : codecs;
    for (const codec of order)
      for (const quality of qualities) {
        let encodeMs = 0;
        for (const file of names) {
          const source = await readFile(join(corpus, file));
          const image = sharp(source).autoOrient().resize({ width: 512, withoutEnlargement: true });
          const started = performance.now();
          const output = await (
            codec.startsWith('jpeg')
              ? image.jpeg({ quality, mozjpeg: codec === 'jpeg-mozjpeg' })
              : codec === 'webp'
                ? image.webp({ quality })
                : image.avif({ quality })
          ).toBuffer();
          encodeMs += performance.now() - started;
          const sha256 = digest(output);
          if (round === 0) {
            const reference = await sharp(source)
              .autoOrient()
              .resize({ width: 512, withoutEnlargement: true })
              .ensureAlpha()
              .raw()
              .toBuffer({ resolveWithObject: true });
            const decoded = await sharp(output)
              .ensureAlpha()
              .raw()
              .toBuffer({ resolveWithObject: true });
            if (
              reference.info.width !== decoded.info.width ||
              reference.info.height !== decoded.info.height
            )
              throw Error('Quality dimensions differ.');
            const score = ssim(
              {
                data: new Uint8ClampedArray(reference.data),
                width: reference.info.width,
                height: reference.info.height,
              },
              {
                data: new Uint8ClampedArray(decoded.data),
                width: decoded.info.width,
                height: decoded.info.height,
              },
              { ssim: 'fast', downsample: false, rgb2grayVersion: 'original', windowSize: 11 },
            ).mssim;
            rows.push({
              file,
              codec,
              quality,
              bytes: output.length,
              referenceBytes: source.length,
              sha256,
              ssim: score,
              width: decoded.info.width,
              height: decoded.info.height,
            });
          } else if (
            rows.find((r) => r.file === file && r.codec === codec && r.quality === quality)
              ?.sha256 !== sha256
          )
            throw Error('Nondeterministic codec output.');
        }
        timings.push({ round, codec, quality, encodeMs });
        await save('quality', {
          environment: env,
          protocol:
            'All 24 Kodak photos resized to width 512 without enlargement. Four Sharp encoder configurations at q50/65/75/85/95; three sequential passes with reversed codec order on odd passes. Timings include decode/resize/encode, exclude disk reads, SSIM and validation. Every repeated output digest must match. SSIM.js 3.5.0 fast algorithm, original luminance conversion, no downsampling, 11px Gaussian window; reference is the identically resized uncompressed RGB image. SSIM is a luminance metric, not a human quality verdict; numeric qualities are not equivalent across codecs. Codecs use Sharp defaults except quality and JPEG mozjpeg flag. This is a codec tradeoff, not evidence of a package-level speedup.',
          rows,
          timings,
        });
        console.log(
          `quality ${round + 1}/3 ${codec} q${quality}: ${encodeMs.toFixed(0)}ms / 24 photos`,
        );
      }
  }
  const summaries = codecs.flatMap((codec) =>
    qualities.map((quality) => {
      const selected = rows.filter((r) => r.codec === codec && r.quality === quality);
      return {
        codec,
        quality,
        outputBytes: selected.reduce((n, r) => n + r.bytes, 0),
        ssim: summary(selected.map((r) => r.ssim)),
        ssimMean: selected.reduce((n, r) => n + r.ssim, 0) / selected.length,
        encodeMs: summary(
          timings.filter((t) => t.codec === codec && t.quality === quality).map((t) => t.encodeMs),
        ),
      };
    }),
  );
  const matched = [0.95, 0.98].flatMap((target) =>
    codecs.map((codec) => {
      const choices = names.map(
        (file) =>
          rows
            .filter((r) => r.file === file && r.codec === codec && r.ssim >= target)
            .sort((a, b) => a.bytes - b.bytes)[0],
      );
      return {
        target,
        codec,
        met: choices.filter(Boolean).length,
        total: names.length,
        bytesOnMetSubset: choices.reduce((n, r) => n + (r?.bytes ?? 0), 0),
        choices: choices.map((r, i) => ({
          file: names[i],
          quality: r?.quality ?? null,
          bytes: r?.bytes ?? null,
          ssim: r?.ssim ?? null,
        })),
      };
    }),
  );
  await save('quality-summary', {
    summaries,
    matched,
    caveat:
      'Discrete quality grid only; threshold choice is illustrative. Compare matched totals only where all 24 images meet the target; failure is retained rather than silently excluding difficult photos.',
  });
  return summaries;
}

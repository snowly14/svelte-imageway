import { it, expect } from 'vitest';
import sharp from 'sharp';
import { rasterFrames } from '../packages/svelte-imageway/src/lib/core/raster.js';
it.each(['jpeg', 'png', 'webp', 'avif', 'gif'] as const)(
  'inspects a real %s without a pixel decode',
  async (format) => {
    const bytes = await sharp({ create: { width: 16, height: 16, channels: 3, background: 'red' } })
      .toFormat(format)
      .toBuffer();
    expect(rasterFrames(bytes)).toBe(1);
  },
);
it('counts real GIF/WebP frames and rejects corrupt/truncated/unbounded containers', async () => {
  const pixels = Buffer.alloc(8 * 16 * 3, 128);
  pixels.fill(255, pixels.length / 2);
  const image = sharp(pixels, { raw: { width: 8, height: 16, pageHeight: 8, channels: 3 } });
  for (const format of ['gif', 'webp'] as const) {
    const bytes = await image
      .clone()
      .toFormat(format, { delay: [100, 200] })
      .toBuffer();
    expect(rasterFrames(bytes)).toBe(2);
    for (const n of [0, 4, 12, bytes.length - 2])
      expect(() => rasterFrames(bytes.subarray(0, n))).toThrow();
  }
  for (const bytes of [
    Buffer.from('not an image'),
    Buffer.from('GIF89a'),
    Buffer.from('GIF89a0000000\0'),
    Buffer.from('GIF89a0000000;'),
  ])
    expect(() => rasterFrames(bytes)).toThrow();
});
function pngChunk(type: string, data: Buffer) {
  const out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length);
  out.write(type, 4);
  data.copy(out, 8);
  return out;
}
it('bounds declared and actual APNG frames before a native decoder', () => {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const count = Buffer.alloc(8);
  count.writeUInt32BE(2);
  const bytes = Buffer.concat([
    signature,
    pngChunk('acTL', count),
    pngChunk('fcTL', Buffer.alloc(26)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
  expect(rasterFrames(bytes)).toBe(2);
  count.writeUInt32BE(101);
  expect(() => rasterFrames(Buffer.concat([signature, pngChunk('acTL', count)]))).toThrow(/frames/);
  expect(() => rasterFrames(Buffer.concat([signature, pngChunk('acTL', Buffer.alloc(1))]))).toThrow(
    /header/,
  );
  expect(() => rasterFrames(signature)).toThrow(/end/);
  expect(() =>
    rasterFrames(
      Buffer.concat([
        signature,
        ...Array.from({ length: 101 }, () => pngChunk('fcTL', Buffer.alloc(26))),
      ]),
    ),
  ).toThrow(/frames/);
});
it('rejects AVIF sequences and WebP/GIF structural bombs', () => {
  const avif = Buffer.alloc(32);
  avif.write('ftyp', 4);
  avif.write('avifavis', 8);
  expect(() => rasterFrames(avif)).toThrow(/sequences/);
  const gif = Buffer.from([
    71,
    73,
    70,
    56,
    57,
    97,
    1,
    0,
    1,
    0,
    0,
    0,
    0,
    ...Array.from({ length: 101 }, () => [44, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 0]).flat(),
    59,
  ]);
  expect(() => rasterFrames(gif)).toThrow(/frames/);
  const chunks = Array.from({ length: 101 }, () => Buffer.from('ANMF\0\0\0\0'));
  const webp = Buffer.concat([Buffer.from('RIFF\0\0\0\0WEBP'), ...chunks]);
  webp.writeUInt32LE(webp.length - 8, 4);
  expect(() => rasterFrames(webp)).toThrow(/frames/);
  webp.writeUInt32LE(1, 4);
  expect(() => rasterFrames(webp)).toThrow(/size/);
});

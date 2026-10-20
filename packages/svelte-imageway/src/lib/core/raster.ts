import { invariant } from './errors.js';
/** Inspect bounded raster containers and animation frame counts without decompressing pixels. */
export function rasterFrames(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (a: number, b: number) => String.fromCharCode(...bytes.subarray(a, b));
  const length = bytes.length;
  const range = (offset: number, size: number) =>
    invariant(offset >= 0 && offset + size <= length, 'RASTER', 'Truncated image container.', 415);
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 1;
  if (ascii(0, 6) === 'GIF89a' || ascii(0, 6) === 'GIF87a') {
    range(0, 13);
    let p = 13;
    const packed = bytes[10]!;
    if (packed & 128) p += 3 * (1 << ((packed & 7) + 1));
    let frames = 0;
    const blocks = () => {
      while (true) {
        range(p, 1);
        const size = bytes[p++]!;
        if (!size) return;
        range(p, size);
        p += size;
      }
    };
    while (p < length) {
      range(p, 1);
      const code = bytes[p++];
      if (code === 59) {
        invariant(frames > 0, 'RASTER', 'GIF has no frames.', 415);
        return frames;
      }
      if (code === 33) {
        range(p, 1);
        p++;
        blocks();
      } else if (code === 44) {
        range(p, 9);
        const flags = bytes[p + 8]!;
        p += 9;
        if (flags & 128) p += 3 * (1 << ((flags & 7) + 1));
        range(p, 1);
        p++;
        blocks();
        frames++;
        invariant(frames <= 100, 'FRAMES', 'Too many animation frames.', 413);
      } else invariant(false, 'RASTER', 'Invalid GIF block.', 415);
    }
    invariant(false, 'RASTER', 'Missing GIF trailer.', 415);
  }
  if (
    length >= 8 &&
    ascii(1, 4) === 'PNG' &&
    bytes[0] === 137 &&
    bytes[4] === 13 &&
    bytes[5] === 10 &&
    bytes[6] === 26 &&
    bytes[7] === 10
  ) {
    let p = 8,
      frames = 0,
      declared = 1;
    while (p < length) {
      range(p, 12);
      const size = view.getUint32(p),
        type = ascii(p + 4, p + 8);
      range(p + 8, size + 4);
      if (type === 'acTL') {
        invariant(size === 8, 'RASTER', 'Invalid APNG header.', 415);
        declared = view.getUint32(p + 8);
      }
      if (type === 'fcTL') frames++;
      invariant(frames <= 100 && declared <= 100, 'FRAMES', 'Too many animation frames.', 413);
      p += size + 12;
      if (type === 'IEND') return Math.max(1, frames, declared);
    }
    invariant(false, 'RASTER', 'Missing PNG end.', 415);
  }
  if (length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') {
    invariant(view.getUint32(4, true) + 8 === length, 'RASTER', 'Invalid WebP size.', 415);
    let p = 12,
      frames = 0;
    while (p < length) {
      range(p, 8);
      const size = view.getUint32(p + 4, true);
      range(p + 8, size);
      if (ascii(p, p + 4) === 'ANMF') frames++;
      invariant(frames <= 100, 'FRAMES', 'Too many animation frames.', 413);
      p += 8 + size + (size % 2);
    }
    invariant(p === length, 'RASTER', 'Truncated WebP chunk.', 415);
    return Math.max(1, frames);
  }
  if (length >= 16 && ascii(4, 8) === 'ftyp' && ascii(8, 64).includes('avif')) {
    invariant(
      !ascii(8, 64).includes('avis'),
      'FRAMES',
      'AVIF sequences need an explicit platform frame limit; unsupported in this Worker.',
      415,
    );
    return 1;
  }
  invariant(
    false,
    'RASTER',
    'Worker accepts JPEG, PNG, GIF, WebP and still AVIF signatures only.',
    415,
  );
  return 1;
}

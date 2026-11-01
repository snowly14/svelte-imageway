// Optimized bounded JS control: slicing-by-four CRC and owned binary output.
export function createPNGBytesControl() {
  const bytes = Buffer.alloc(4400);
  const table = Uint32Array.from({ length: 256 }, (_, index) => {
    let c = index;
    for (let bit = 0; bit < 8; bit++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
    return c >>> 0;
  });
  const next = (previous: Uint32Array) =>
    Uint32Array.from(previous, (value) => (value >>> 8) ^ table[value & 255]!);
  const table2 = next(table),
    table3 = next(table2),
    table4 = next(table3);
  return (w: number, h: number, rgba: Uint8Array) => {
    if (
      !Number.isInteger(w) ||
      !Number.isInteger(h) ||
      w < 1 ||
      h < 1 ||
      w > 32 ||
      h > 32 ||
      rgba.length !== w * h * 4
    )
      throw Error('Invalid bounded PNG.');
    const row = w * 4 + 1,
      idat = 6 + h * (5 + row);
    bytes.set([
      137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 0, 0, 0, 0, 0, 8, 6, 0,
      0, 0, 0, 0, 0, 0,
    ]);
    bytes.writeUInt32BE(w, 16);
    bytes.writeUInt32BE(h, 20);
    bytes.writeUInt32BE(idat, 33);
    bytes.set([73, 68, 65, 84, 120, 1], 37);
    let offset = 43,
      a = 1,
      b = 0;
    for (let y = 0; y < h; y++) {
      bytes.set([y + 1 < h ? 0 : 1, row & 255, row >> 8, ~row & 255, (row >> 8) ^ 255, 0], offset);
      offset += 6;
      b += a;
      for (let x = 0; x < w * 4; x++) {
        const value = rgba[y * w * 4 + x]!;
        bytes[offset++] = value;
        a += value;
        b += a;
      }
      a %= 65521;
      b %= 65521;
    }
    bytes.writeUInt32BE(((b << 16) | a) >>> 0, offset);
    offset += 4;
    bytes.set([0, 0, 0, 0, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130], offset);
    for (const [start, end] of [
      [12, 29],
      [37, 41 + idat],
    ] as const) {
      let c = ~0;
      let i = start;
      for (; i + 4 <= end; i += 4) {
        const word =
          (bytes[i]! | (bytes[i + 1]! << 8) | (bytes[i + 2]! << 16) | (bytes[i + 3]! << 24)) ^ c;
        c =
          table4[word & 255]! ^
          table3[(word >>> 8) & 255]! ^
          table2[(word >>> 16) & 255]! ^
          table[word >>> 24]!;
      }
      for (; i < end; i++) c = (c >>> 8) ^ table[(c ^ bytes[i]!) & 255]!;
      bytes.writeUInt32BE(~c >>> 0, end);
    }
    return Uint8Array.from(bytes.subarray(0, offset + 16));
  };
}

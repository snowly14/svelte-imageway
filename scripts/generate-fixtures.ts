import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
const width = 1200,
  height = 800;
const pixels = Buffer.alloc(width * height * 3);
let seed = 42;
for (let y = 0; y < height; y++)
  for (let x = 0; x < width; x++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = (seed >>> 24) / 8;
    const mountain = y > 420 + 110 * Math.sin(x / 180) - 60 * Math.cos(x / 71);
    const i = (y * width + x) * 3;
    pixels[i] = Math.min(255, (mountain ? 35 + y / 15 : 115 + y / 5) + noise);
    pixels[i + 1] = Math.min(255, (mountain ? 75 + y / 22 : 175 + y / 10) + noise);
    pixels[i + 2] = Math.min(255, (mountain ? 70 + y / 30 : 225) + noise);
  }
await mkdir('examples/components/src', { recursive: true });
await sharp(pixels, { raw: { width, height, channels: 3 } })
  .png()
  .toFile('examples/components/src/landscape.png');

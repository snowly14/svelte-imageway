import { readFile, writeFile, cp, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createSparseColourControl } from './control.ts';
import { createPNGControl } from '../lean-preview/control.ts';
const base = resolve('.local/component-3.1.8/baseline/package'),
  control = resolve('.local/sparse-colour/js-control/package');
await mkdir(control, { recursive: true });
await cp(base, control, { recursive: true });
let text = await readFile(join(base, 'dist/node/blurhash.js'), 'utf8');
const anchor = 'export async function createBlurhashEncoder(bytes) {';
if (!text.includes(anchor)) throw Error('Unexpected factory source');
text = text.replace(
  anchor,
  anchor +
    `\nconst sparseColour=(${createSparseColourControl.toString()})();\nconst packPNG=(${createPNGControl.toString()})();\n`,
);
const before = text;
text = text.replace(
  /dominantColor\(input, width, height\) \{[\s\S]*?\n\s*\},\n\s*encode\(/,
  'dominantColor(input,width,height){return sparseColour(input,width,height);},\n encode(',
);
if (text === before) throw Error('No histogram control installed');
const second = text;
text = text.replace(
  /thumbHashDataURL\(hash\) \{[\s\S]*?\n\s*\},\n\s*decodeThumbHash\(/,
  'thumbHashDataURL(hash){const {w,h}=decodeThumb(hash);return packPNG(w,h,pixels.subarray(0,w*h*4));},\n decodeThumbHash(',
);
if (text === second) throw Error('No PNG control installed');
await writeFile(join(control, 'dist/node/blurhash.js'), text);

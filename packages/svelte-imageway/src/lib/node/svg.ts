import { SaxesParser } from 'saxes';
import { ImagewayError, invariant } from '../core/errors.js';
const tags = new Set([
  'svg',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'g',
  'defs',
  'linearGradient',
  'radialGradient',
  'stop',
  'clipPath',
  'mask',
]);
const attributes = new Set([
  'xmlns',
  'width',
  'height',
  'viewBox',
  'preserveAspectRatio',
  'x',
  'y',
  'x1',
  'x2',
  'y1',
  'y2',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'd',
  'points',
  'fill',
  'fill-rule',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-opacity',
  'opacity',
  'transform',
  'id',
  'offset',
  'stop-color',
  'stop-opacity',
  'gradientUnits',
  'gradientTransform',
  'spreadMethod',
  'clipPathUnits',
  'maskUnits',
  'maskContentUnits',
]);
/** A strict, intentionally small geometry-only SVG dialect; reject rather than strip active content. */
export function validateSvg(text: string): void {
  invariant(
    !/[&\\]|url\s*\(/i.test(text),
    'SVG',
    'SVG references, entities and CSS escapes are disabled.',
    415,
  );
  let nodes = 0,
    depth = 0;
  const parser = new SaxesParser({ xmlns: false });
  const reject = () => {
    throw new ImagewayError('SVG', 'Only well-formed geometry-only SVG is accepted.', 415);
  };
  parser.on('error', reject);
  parser.on('doctype', reject);
  parser.on('processinginstruction', reject);
  parser.on('cdata', reject);
  parser.on('text', (value) => {
    if (value.trim()) reject();
  });
  parser.on('opentag', (node) => {
    if (
      ++nodes > 10000 ||
      ++depth > 32 ||
      !tags.has(node.name) ||
      (depth === 1 && node.name !== 'svg')
    )
      reject();
    for (const [name, value] of Object.entries(node.attributes)) {
      if (
        !attributes.has(name) ||
        (name === 'xmlns' && value !== 'http://www.w3.org/2000/svg') ||
        /[<>]/.test(value) ||
        [...value].some((c) => c.charCodeAt(0) < 32)
      )
        reject();
    }
  });
  parser.on('closetag', () => depth--);
  try {
    parser.write(text).close();
  } catch (error) {
    if (error instanceof ImagewayError) throw error;
    reject();
  }
  invariant(nodes > 0, 'SVG', 'Empty SVG document.', 415);
}

import { readFile, writeFile } from 'node:fs/promises';
const url = new URL('../examples/components/dist-ssr/ssr.js', import.meta.url);
const { page } = await import(url.href) as { page: () => { body: string; head: string } };
const rendered = page();
const file = 'examples/components/dist/index.html';
const html = (await readFile(file, 'utf8')).replace('<div id="app"></div>', `<div id="app">${rendered.body}</div>`).replace('</head>', `${rendered.head}</head>`);
await writeFile(file, html);
console.log(`SSR example rendered: ${rendered.body.length} body bytes, ${rendered.head.length} head bytes.`);

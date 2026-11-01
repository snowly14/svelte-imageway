import { expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

it('loads the XML parser only when validating SVG in a fresh Node process', async () => {
  const moduleURL = pathToFileURL(resolve('packages/svelte-imageway/dist/node/pipeline.js')).href;
  const script = `
    import { createRequire } from 'node:module';
    import assert from 'node:assert/strict';
    const require = createRequire(import.meta.url);
    const parser = require.resolve('saxes');
    const { sniff } = await import(${JSON.stringify(moduleURL)});
    assert.equal(require.cache[parser], undefined);
    assert.equal(sniff(Buffer.from([137,80,78,71,13,10,26,10])), 'png');
    assert.equal(require.cache[parser], undefined);
    assert.equal(sniff(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')), 'svg');
    assert.ok(require.cache[parser]);
    assert.throws(() => sniff(Buffer.from('<svg><script/></svg>')), e => e.code === 'SVG');
    console.log('validated');
  `;
  const { stdout } = await promisify(execFile)(
    process.execPath,
    ['--input-type=module', '-e', script],
    { timeout: 10000 },
  );
  expect(stdout.trim()).toBe('validated');
});

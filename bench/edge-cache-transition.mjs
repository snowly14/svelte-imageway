import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const option = (name, fallback) =>
  process.argv.find((v) => v.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const before = resolve(option('baseline', '.local/cache-split/baseline/package'));
const after = resolve(option('candidate', 'packages/svelte-imageway'));
const load = (root, path) => import(pathToFileURL(join(root, 'dist', path)).href);
const oldSourceHash = createHash('sha256')
  .update(await readFile(join(before, 'dist/edge/worker.js')))
  .digest('hex');
assert.equal(oldSourceHash, 'c061ac54938305040ab9e005da3a0fc564c3c60bb8a5dcaae48e5f731084c3cf');
const oldRevision = (await load(before, 'version.js')).PIPELINE_REVISION;
const newRevision = (await load(after, 'version.js')).PIPELINE_REVISION;
assert.equal(
  newRevision,
  oldRevision,
  'This proof requires the reviewed compatible Node revision.',
);
const values = new Map();
const kv = {
  async get(key) {
    return structuredClone(values.get(key));
  },
  async put(key, value) {
    values.set(key, structuredClone(value));
  },
};
let tail = Promise.resolve();
const storage = {
  ...kv,
  transaction(callback) {
    const next = tail.then(() => callback(kv));
    tail = next.catch(() => {});
    return next;
  },
};
const { ImageBudget } = await load(after, 'edge/budget.js');
const budget = new ImageBudget({ storage });
const entries = new Map();
const cache = {
  async match(request) {
    return entries.get(request.url)?.clone();
  },
  async put(request, response) {
    entries.set(request.url, response.clone());
  },
};
const env = {
  PUBLIC_SOURCES: 'true',
  SOURCE_PREFIX: 'images/',
  BUDGET: {
    getByName() {
      return budget;
    },
  },
  ORIGINALS: {
    async get() {
      return {
        size: 1,
        body: new Response(new Uint8Array([1])).body,
        arrayBuffer: async () => new Uint8Array([1]).buffer,
        customMetadata: { tags: 'fixture' },
      };
    },
    async put() {},
  },
};
let oldTransforms = 0,
  newTransforms = 0;
const make = async (root, kind) =>
  (await load(root, 'edge/worker.js')).createImageWorker({
    cache,
    transform: async () => {
      if (kind === 'old') oldTransforms++;
      else newTransforms++;
      return new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/webp' } });
    },
  });
const oldWorker = await make(before, 'old'),
  newWorker = await make(after, 'new');
const run = async (worker) => {
  const tasks = [];
  const response = await worker.fetch(
    new Request('https://worker.example/_img/v1?key=images/a.png&preset=card&format=webp'),
    env,
    {
      waitUntil(p) {
        tasks.push(p);
      },
    },
  );
  await Promise.all(tasks);
  assert.equal(response.status, 200);
  return response.headers.get('x-imageway-cache');
};
assert.equal(await run(oldWorker), 'MISS');
const legacyKey = [...entries.keys()][0];
assert.equal(await run(newWorker), 'MISS');
assert.equal(await run(newWorker), 'HIT');
assert.equal(oldTransforms, 1);
assert.equal(newTransforms, 1);
assert.equal(entries.size, 2);
const currentKey = [...entries.keys()].find((k) => k !== legacyKey);
const result = {
  protocol:
    'Actual verified 3.1.9 Worker module and selected Worker share cache, budget and synthetic source/transform bindings. Both Node revisions equal, but legacy cache misses and new unchanged-policy cache hits. Not a codec, live-cloud or HTTP benchmark.',
  oldSourceHash,
  oldRevision,
  newRevision,
  legacyKey,
  currentKey,
  oldTransforms,
  newTransforms,
  entryCount: entries.size,
};
await writeFile(
  option('output', '.local/edge-cache-transition-proof.json'),
  JSON.stringify(result, null, 2) + '\n',
  { flag: 'wx' },
);
console.log('Legacy Edge entry missed; selected policy-bound entry hit.');

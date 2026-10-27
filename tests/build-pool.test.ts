import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Worker } from 'node:worker_threads';
import { EventEmitter } from 'node:events';
import {
  ViteBuildPool,
  type BuildWorkerEndpoint,
} from '../packages/svelte-imageway/src/lib/node/build-pool.js';
import { defineConfig } from '../packages/svelte-imageway/src/lib/core/config.js';
import { normalizeRequest } from '../packages/svelte-imageway/src/lib/core/url.js';
import type { TransformTask } from '../packages/svelte-imageway/src/lib/node/pool.js';
import type { TransformResult } from '../packages/svelte-imageway/src/lib/node/pipeline.js';
class Endpoint extends EventEmitter implements BuildWorkerEndpoint {
  sent: Array<{ id: number; task: TransformTask }> = [];
  terminations = 0;
  refs = 0;
  unrefs = 0;
  dispatchError = false;
  end: () => Promise<number> = () => Promise.resolve(0);
  postMessage(value: unknown) {
    if (this.dispatchError) throw Error('clone failed');
    this.sent.push(value as (typeof this.sent)[number]);
  }
  terminate() {
    this.terminations++;
    return this.end();
  }
  ref() {
    this.refs++;
  }
  unref() {
    this.unrefs++;
  }
  reply(index: number, value: TransformResult = result()) {
    this.emit('message', { id: this.sent[index]!.id, value });
  }
}
function result(data = new Uint8Array([1, 2, 3])): TransformResult {
  return {
    data: Buffer.from(data.buffer, data.byteOffset, data.byteLength),
    width: 1,
    height: 1,
    format: 'webp',
    dominantColor: '#123456',
    placeholder: '',
  };
}
function task(timeoutMs = 10000): TransformTask {
  const config = defineConfig({ timeoutMs });
  return {
    data: new Uint8Array([1, 2, 3]),
    config,
    request: normalizeRequest({ key: 'photo', w: 1 }, config),
    format: 'webp',
    preview: false,
  };
}
const flush = async () => {
  for (let i = 0; i < 15; i++) await Promise.resolve();
};
beforeEach(() => vi.useFakeTimers({ now: 0 }));
afterEach(() => vi.useRealTimers());
it('bounds logical parallelism in one worker, routes out-of-order replies and drains finite waiters', async () => {
  const worker = new Endpoint(),
    factory = vi.fn(() => worker),
    pool = new ViteBuildPool(2, factory);
  const a = pool.runBuild(task()),
    b = pool.runBuild(task()),
    c = pool.runBuild(task());
  await flush();
  expect(factory).toHaveBeenCalledTimes(1);
  expect(worker.sent).toHaveLength(2);
  worker.reply(1, result(new Uint8Array([22])));
  expect((await b).data[0]).toBe(22);
  await flush();
  expect(worker.sent).toHaveLength(3);
  worker.reply(2, result(new Uint8Array([33])));
  worker.reply(0, result(new Uint8Array([11])));
  expect((await a).data[0]).toBe(11);
  expect((await c).data[0]).toBe(33);
  expect(worker.unrefs).toBe(1);
});
it('preserves exclusive transfer buffers and copies subviews without exposing unrelated backing bytes', async () => {
  const worker = new Endpoint(),
    pool = new ViteBuildPool(1, () => worker),
    backing = new Uint8Array(20).fill(9);
  const a = pool.runBuild(task());
  await flush();
  worker.reply(0, result(backing.subarray(4, 7)));
  const first = await a;
  expect(first.data).toEqual(Buffer.from([9, 9, 9]));
  backing[4] = 0;
  expect(first.data[0]).toBe(9);
  const owned = new Uint8Array([4, 5]);
  const b = pool.runBuild(task());
  await flush();
  worker.reply(1, result(owned));
  expect((await b).data.buffer).toBe(owned.buffer);
});
it('keeps ordinary task errors local and preserves their public error codes', async () => {
  const worker = new Endpoint(),
    pool = new ViteBuildPool(2, () => worker);
  const a = pool.runBuild(task()).catch((e) => e),
    b = pool.runBuild(task());
  await flush();
  worker.emit('message', {
    id: worker.sent[0]!.id,
    error: { code: 'PIXELS', message: 'Pixel limit.', status: 413 },
  });
  worker.reply(1);
  expect(await a).toMatchObject({ code: 'PIXELS', status: 413 });
  expect((await b).format).toBe('webp');
  expect(worker.terminations).toBe(0);
});
it('does not release permits, accept late replies or start replacement work before hard termination completes', async () => {
  const first = new Endpoint(),
    next = new Endpoint();
  let finish!: () => void;
  first.end = () =>
    new Promise((resolve) => {
      finish = () => resolve(0);
    });
  const factory = vi.fn().mockReturnValueOnce(first).mockReturnValue(next),
    pool = new ViteBuildPool(2, factory);
  const a = pool.runBuild(task(1)).catch((e) => e),
    b = pool.runBuild(task(10000)).catch((e) => e),
    c = pool.runBuild(task());
  await flush();
  expect(first.sent).toHaveLength(2);
  await vi.advanceTimersByTimeAsync(1001);
  expect(first.terminations).toBe(1);
  expect(factory).toHaveBeenCalledTimes(1);
  let settled = false;
  void a.then(() => {
    settled = true;
  });
  await flush();
  expect(settled).toBe(false);
  first.reply(0);
  first.reply(1);
  await flush();
  expect(settled).toBe(false);
  finish();
  expect(await a).toMatchObject({ code: 'TIMEOUT', status: 504 });
  expect(await b).toMatchObject({ code: 'WORKER' });
  await flush();
  expect(factory).toHaveBeenCalledTimes(2);
  expect(next.sent).toHaveLength(1);
  next.reply(0);
  await c;
});
it.each(['error', 'exit', 'unknown-id', 'invalid-payload', 'invalid-status', 'dispatch'] as const)(
  'stops a fatal %s before settling and then recovers',
  async (kind) => {
    const first = new Endpoint(),
      second = new Endpoint(),
      factory = vi.fn().mockReturnValueOnce(first).mockReturnValue(second),
      pool = new ViteBuildPool(1, factory);
    if (kind === 'dispatch') first.dispatchError = true;
    const a = pool.runBuild(task()).catch((e) => e);
    await flush();
    if (kind === 'error') first.emit('error', new Error('upstream-secret'));
    if (kind === 'exit') first.emit('exit', 1);
    if (kind === 'unknown-id') first.emit('message', { id: 999, value: result() });
    if (kind === 'invalid-payload')
      first.emit('message', { id: first.sent[0]!.id, value: { data: 'bad' } });
    if (kind === 'invalid-status')
      first.emit('message', {
        id: first.sent[0]!.id,
        error: { code: 'X', message: 'bad', status: -1 },
      });
    expect(await a).toMatchObject({ code: 'WORKER' });
    expect(first.terminations).toBe(1);
    const b = pool.runBuild(task());
    await flush();
    expect(second.sent).toHaveLength(1);
    second.reply(0);
    await b;
  },
);
it('fails closed after a rejected termination and admits no new native work until an exit confirms it stopped', async () => {
  const first = new Endpoint(),
    second = new Endpoint();
  first.end = () => Promise.reject(Error('cannot terminate'));
  const factory = vi.fn().mockReturnValueOnce(first).mockReturnValue(second),
    pool = new ViteBuildPool(1, factory);
  const a = pool.runBuild(task(1)).catch((e) => e);
  await flush();
  await vi.advanceTimersByTimeAsync(1001);
  expect(await a).toMatchObject({ code: 'WORKER' });
  await expect(pool.runBuild(task())).rejects.toMatchObject({ code: 'WORKER' });
  expect(factory).toHaveBeenCalledTimes(1);
  first.emit('exit', 1);
  await flush();
  const b = pool.runBuild(task());
  await flush();
  expect(factory).toHaveBeenCalledTimes(2);
  second.reply(0);
  await b;
});
it('bounds startup waits and never creates an orphan replacement after a waiting job expires', async () => {
  const first = new Endpoint(),
    second = new Endpoint();
  let finish!: () => void;
  first.end = () =>
    new Promise((resolve) => {
      finish = () => resolve(0);
    });
  const factory = vi.fn().mockReturnValueOnce(first).mockReturnValue(second),
    pool = new ViteBuildPool(1, factory);
  const a = pool.runBuild(task());
  await flush();
  first.reply(0);
  await a;
  await vi.advanceTimersByTimeAsync(5000);
  expect(first.terminations).toBe(1);
  const b = pool.runBuild(task(1)).catch((e) => e);
  await flush();
  await vi.advanceTimersByTimeAsync(1001);
  expect(await b).toMatchObject({ code: 'TIMEOUT' });
  finish();
  await flush();
  expect(factory).toHaveBeenCalledTimes(1);
  const c = pool.runBuild(task());
  await flush();
  second.reply(0);
  await c;
});
it('clears idle timers on reuse and retires an idle worker without retaining the process', async () => {
  const worker = new Endpoint(),
    pool = new ViteBuildPool(1, () => worker),
    a = pool.runBuild(task());
  await flush();
  worker.reply(0);
  await a;
  await vi.advanceTimersByTimeAsync(4999);
  expect(worker.terminations).toBe(0);
  const b = pool.runBuild(task());
  await flush();
  worker.reply(1);
  await b;
  await vi.advanceTimersByTimeAsync(1);
  expect(worker.terminations).toBe(0);
  await vi.advanceTimersByTimeAsync(5000);
  expect(worker.terminations).toBe(1);
});
it('rejects runtime admission and invalid concurrency without spawning a worker', async () => {
  const factory = vi.fn(() => new Endpoint());
  for (const count of [0, -1, 33, NaN, 1.5])
    expect(() => new ViteBuildPool(count, factory)).toThrow();
  await expect(new ViteBuildPool(1, factory).run(task())).rejects.toMatchObject({
    code: 'POOL_SCOPE',
  });
  expect(factory).not.toHaveBeenCalled();
});

it('releases a finite build permit after worker construction fails', async () => {
  const worker = new Endpoint();
  let attempts = 0;
  const pool = new ViteBuildPool(1, () => {
    if (attempts++ === 0) throw new Error('Worker construction failed.');
    return worker;
  });
  await expect(pool.runBuild(task())).rejects.toThrow('Worker construction failed.');
  const recovered = pool.runBuild(task());
  await flush();
  worker.reply(0);
  expect((await recovered).format).toBe('webp');
});
it('terminates real stuck native execution before a replacement produces byte-identical output', async () => {
  vi.useRealTimers();
  const sharp = (await import('sharp')).default;
  const { transform } = await import('../packages/svelte-imageway/dist/node/pipeline.js');
  const source = await sharp({
    create: { width: 64, height: 48, channels: 4, background: '#123456' },
  })
    .png()
    .toBuffer();
  const input = task();
  input.data = new Uint8Array(new SharedArrayBuffer(source.length));
  input.data.set(source);
  let calls = 0;
  const pool = new ViteBuildPool(
    2,
    () =>
      ++calls === 1
        ? new Worker('while (true) {}', {
            eval: true,
            resourceLimits: { maxOldGenerationSizeMb: 64 },
          })
        : new Worker(
            new URL('../packages/svelte-imageway/dist/node/build-worker.js', import.meta.url),
            { resourceLimits: { maxOldGenerationSizeMb: 64 } },
          ),
    10,
  );
  await expect(
    pool.runBuild({ ...input, config: defineConfig({ timeoutMs: 1 }) }),
  ).rejects.toMatchObject({ code: 'TIMEOUT', status: 504 });
  const [a, b] = await Promise.all([pool.runBuild(input), pool.runBuild(input)]);
  const reference = await transform(input.data, input.request, input.format, input.config, false);
  expect(a).toEqual(reference);
  expect(b).toEqual(reference);
  a.data.fill(0);
  expect(b.data).toEqual(reference.data);
  expect(calls).toBe(2);
});

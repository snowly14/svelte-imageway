// Copied only into an ignored benchmark package, never into the published dist.
import { parentPort, isMarkedAsUntransferable } from 'node:worker_threads';
import { transform } from '../../packages/svelte-imageway/src/lib/node/pipeline.js';
import { ImagewayError } from '../../packages/svelte-imageway/src/lib/core/errors.js';
import type { TransformTask } from '../../packages/svelte-imageway/src/lib/node/pool.js';
parentPort?.on('message', async ({ id, task }: { id: number; task: TransformTask }) => {
  try {
    const value = await transform(task.data, task.request, task.format, task.config, task.preview),
      buffer = value.data.buffer;
    const transfer =
      buffer instanceof ArrayBuffer &&
      value.data.byteOffset === 0 &&
      buffer.byteLength === value.data.byteLength &&
      !isMarkedAsUntransferable(buffer);
    parentPort!.postMessage({ id, value }, transfer ? [buffer] : []);
  } catch (error) {
    const e =
      error instanceof ImagewayError
        ? error
        : new ImagewayError('WORKER', 'Image processing failed.', 500);
    parentPort!.postMessage({ id, error: { code: e.code, message: e.message, status: e.status } });
  }
});

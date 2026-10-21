import { parentPort, isMarkedAsUntransferable } from 'node:worker_threads';
import { transform } from './pipeline.js';
import { ImagewayError } from '../core/errors.js';
import type { TransformTask } from './pool.js';
// One admitted job per worker; the pool owns lifecycle, byte admission and deadlines.
parentPort?.on('message', async (task: TransformTask) => {
  try {
    const value = await transform(task.data, task.request, task.format, task.config, task.preview);
    const buffer = value.data.buffer;
    // Only transfer an exclusively owned, exact-sized allocation. Never transfer
    // pooled buffers, shared memory or a view exposing unrelated backing bytes.
    const transfer =
      buffer instanceof ArrayBuffer &&
      value.data.byteOffset === 0 &&
      buffer.byteLength === value.data.byteLength &&
      !isMarkedAsUntransferable(buffer);
    parentPort!.postMessage({ value }, transfer ? [buffer] : []);
  } catch (error) {
    const e =
      error instanceof ImagewayError
        ? error
        : new ImagewayError('WORKER', 'Image processing failed.', 500);
    parentPort!.postMessage({ error: { code: e.code, message: e.message, status: e.status } });
  }
});

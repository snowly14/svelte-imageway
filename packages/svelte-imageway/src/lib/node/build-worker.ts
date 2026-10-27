import { parentPort, isMarkedAsUntransferable } from 'node:worker_threads';
import { transform } from './pipeline.js';
import { ImagewayError } from '../core/errors.js';
import type { TransformTask } from './pool.js';
// The private Vite pool owns IDs, finite admission and fatal-worker deadlines.
// Public runtime workers keep their original isolated single-job protocol.
parentPort?.on('message', async ({ id, task }: { id: number; task: TransformTask }) => {
  try {
    const value = await transform(task.data, task.request, task.format, task.config, task.preview);
    const buffer = value.data.buffer;
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

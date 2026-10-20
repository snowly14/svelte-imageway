import { parentPort } from 'node:worker_threads';
import { transform } from './pipeline.js';
import { ImagewayError } from '../core/errors.js';
import type { TransformTask } from './pool.js';
// One admitted job per worker; the pool owns lifecycle, byte admission and deadlines.
parentPort?.on('message', async (task: TransformTask) => {
  try {
    parentPort!.postMessage({
      value: await transform(task.data, task.request, task.format, task.config, task.preview),
    });
  } catch (error) {
    const e =
      error instanceof ImagewayError
        ? error
        : new ImagewayError('WORKER', 'Image processing failed.', 500);
    parentPort!.postMessage({ error: { code: e.code, message: e.message, status: e.status } });
  }
});

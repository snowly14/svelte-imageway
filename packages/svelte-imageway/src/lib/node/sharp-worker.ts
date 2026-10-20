import { parentPort, workerData } from 'node:worker_threads';
import { transform } from './pipeline.js';
import { ImagewayError } from '../core/errors.js';

if (parentPort) {
  try {
    parentPort.postMessage({
      value: await transform(
        workerData.data,
        workerData.request,
        workerData.format,
        workerData.config,
      ),
    });
  } catch (error) {
    const e =
      error instanceof ImagewayError
        ? error
        : new ImagewayError('WORKER', 'Image processing failed.', 500);
    parentPort.postMessage({ error: { code: e.code, message: e.message, status: e.status } });
  }
}

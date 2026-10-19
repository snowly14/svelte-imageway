import { Worker } from 'node:worker_threads';
import { cpus } from 'node:os';
import { invariant, ImagewayError } from '../core/errors.js';
import type { ImageConfig, NormalizedRequest, OutputFormat } from '../core/types.js';
import type { TransformResult } from './pipeline.js';

interface Task { data: Uint8Array; request: NormalizedRequest; format: OutputFormat; config: ImageConfig }
/** Bounded worker_threads pool; use built package output for Node worker module URLs. */
export class TransformPool {
  private active = 0;
  private waiting: Array<() => void> = [];
  constructor(private readonly concurrency = Math.max(1, Math.min(4, cpus().length - 1)), private readonly maxQueue = 64) {
    invariant(Number.isSafeInteger(concurrency) && concurrency > 0 && concurrency <= 32 && maxQueue >= 0, 'POOL', 'Invalid worker concurrency or queue limit.');
  }
  async run(task: Task): Promise<TransformResult> {
    if (this.active >= this.concurrency) {
      invariant(this.waiting.length < this.maxQueue, 'QUEUE', 'Transform queue capacity reached.', 429);
      await new Promise<void>(resolve => this.waiting.push(resolve));
    } else this.active++;
    try {
      return await new Promise<TransformResult>((resolve, reject) => {
        const worker = new Worker(new URL('./sharp-worker.js', import.meta.url), { workerData: task });
        const timer = setTimeout(() => { void worker.terminate(); reject(new ImagewayError('TIMEOUT', 'Image worker exceeded its deadline.', 504)); }, task.config.timeoutMs + 1000);
        worker.once('message', (result: { value?: TransformResult; error?: { code: string; message: string; status: number } }) => {
          if (result.error) reject(new ImagewayError(result.error.code, result.error.message, result.error.status));
          else resolve({ ...result.value!, data: Buffer.from(result.value!.data) });
        });
        worker.once('error', reject);
        worker.once('exit', code => { clearTimeout(timer); if (code) reject(new ImagewayError('WORKER', 'Image worker failed.', 500)); });
      });
    } finally { const next = this.waiting.shift(); if (next) next(); else this.active--; }
  }
}

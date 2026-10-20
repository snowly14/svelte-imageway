import { Worker } from 'node:worker_threads';
import { cpus } from 'node:os';
import { invariant, ImagewayError } from '../core/errors.js';
import type { ImageConfig, NormalizedRequest, OutputFormat } from '../core/types.js';
import type { TransformResult } from './pipeline.js';
interface Task {
  data: Uint8Array;
  request: NormalizedRequest;
  format: OutputFormat;
  config: ImageConfig;
}
interface Waiting {
  bytes: number;
  begin: () => void;
}
/** Bounded worker pool; admission includes queue time and retains a slot until its native worker exits. */
export class TransformPool {
  private active = 0;
  private waiting: Waiting[] = [];
  private queuedBytes = 0;
  constructor(
    private readonly concurrency = Math.max(1, Math.min(2, cpus().length - 1)),
    private readonly maxQueue = 64,
    private readonly maxQueueBytes = 64_000_000,
  ) {
    invariant(
      Number.isSafeInteger(concurrency) &&
        concurrency > 0 &&
        concurrency <= 32 &&
        Number.isSafeInteger(maxQueue) &&
        maxQueue >= 0 &&
        maxQueueBytes > 0,
      'POOL',
      'Invalid worker concurrency or queue limit.',
    );
  }
  async run(task: Task): Promise<TransformResult> {
    const deadline = Date.now() + task.config.timeoutMs + 1000;
    if (this.active >= this.concurrency) {
      invariant(
        this.waiting.length < this.maxQueue &&
          this.queuedBytes + task.data.byteLength <= this.maxQueueBytes,
        'QUEUE',
        'Transform queue capacity reached.',
        429,
      );
      await new Promise<void>((resolve, reject) => {
        const entry: Waiting = {
          bytes: task.data.byteLength,
          begin: () => {
            clearTimeout(timer);
            resolve();
          },
        };
        this.queuedBytes += entry.bytes;
        this.waiting.push(entry);
        const timer = setTimeout(
          () => {
            const index = this.waiting.indexOf(entry);
            if (index >= 0) {
              this.waiting.splice(index, 1);
              this.queuedBytes -= entry.bytes;
              reject(new ImagewayError('TIMEOUT', 'Transform queue deadline exceeded.', 504));
            }
          },
          Math.max(1, deadline - Date.now()),
        );
      });
    } else this.active++;
    try {
      invariant(Date.now() < deadline, 'TIMEOUT', 'Transform deadline exceeded in queue.', 504);
      return await new Promise<TransformResult>((resolve, reject) => {
        const worker = new Worker(new URL('./sharp-worker.js', import.meta.url), {
          workerData: task,
        });
        let value: TransformResult | undefined, failure: unknown;
        const timer = setTimeout(
          () => {
            failure = new ImagewayError('TIMEOUT', 'Image worker exceeded its deadline.', 504);
            void worker.terminate();
          },
          Math.max(1, deadline - Date.now()),
        );
        worker.once(
          'message',
          (result: {
            value?: TransformResult;
            error?: { code: string; message: string; status: number };
          }) => {
            if (result.error)
              failure = new ImagewayError(
                result.error.code,
                result.error.message,
                result.error.status,
              );
            else value = result.value;
          },
        );
        worker.once('error', (error) => {
          failure = error;
        });
        worker.once('exit', (code) => {
          clearTimeout(timer);
          if (failure) reject(failure);
          else if (code || !value) reject(new ImagewayError('WORKER', 'Image worker failed.', 500));
          else resolve({ ...value, data: Buffer.from(value.data) });
        });
      });
    } finally {
      const next = this.waiting.shift();
      if (next) {
        this.queuedBytes -= next.bytes;
        next.begin();
      } else this.active--;
    }
  }
}
const pools = new Map<number, TransformPool>();
/** Share admission across all per-import processors, rather than multiplying concurrency for every import. */
export function sharedPool(
  concurrency = Math.max(1, Math.min(2, cpus().length - 1)),
): TransformPool {
  let pool = pools.get(concurrency);
  if (!pool) {
    pool = new TransformPool(concurrency);
    pools.set(concurrency, pool);
  }
  return pool;
}

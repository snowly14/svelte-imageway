import { Worker } from 'node:worker_threads';
import { cpus } from 'node:os';
import { invariant, ImagewayError } from '../core/errors.js';
import type { ImageConfig, NormalizedRequest, OutputFormat } from '../core/types.js';
import type { TransformResult } from './pipeline.js';
export interface TransformTask {
  data: Uint8Array;
  request: NormalizedRequest;
  format: OutputFormat;
  config: ImageConfig;
  preview?: boolean;
}
interface Waiting {
  bytes: number;
  begin: () => void;
}
interface Idle {
  worker: Worker;
  timer: ReturnType<typeof setTimeout>;
}
/** Reusable workers, bounded admission including queue time, and termination before releasing timed-out native work. */
export class TransformPool {
  private buildActive = 0;
  private buildWaiting: Array<() => void> = [];
  private active = 0;
  private waiting: Waiting[] = [];
  private queuedBytes = 0;
  private idle: Idle[] = [];
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
  private acquire(): Worker {
    while (this.idle.length) {
      const item = this.idle.pop()!;
      clearTimeout(item.timer);
      if (item.worker.threadId !== -1) {
        item.worker.ref();
        return item.worker;
      }
    }
    const worker = new Worker(new URL('./sharp-worker.js', import.meta.url), {
      resourceLimits: { maxOldGenerationSizeMb: 64 },
    });
    worker.on('error', () => {
      /* Active jobs attach a rejecting listener; an idle worker error must not crash the host. */
    });
    return worker;
  }
  private retain(worker: Worker): void {
    worker.unref();
    const item: Idle = {
      worker,
      timer: setTimeout(() => {
        const i = this.idle.indexOf(item);
        if (i >= 0) this.idle.splice(i, 1);
        void worker.terminate();
      }, 5000),
    };
    item.timer.unref();
    this.idle.push(item);
  }
  /** Finite trusted builds wait outside request admission; each admitted
   * transform still uses the same bounded workers and execution deadline. */
  async runBuild(task: TransformTask): Promise<TransformResult> {
    if (this.buildActive >= this.concurrency)
      await new Promise<void>((resolve) => this.buildWaiting.push(resolve));
    else this.buildActive++;
    try {
      return await this.run(task);
    } finally {
      const next = this.buildWaiting.shift();
      if (next) next();
      else this.buildActive--;
    }
  }
  async run(task: TransformTask): Promise<TransformResult> {
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
            const i = this.waiting.indexOf(entry);
            if (i >= 0) {
              this.waiting.splice(i, 1);
              this.queuedBytes -= entry.bytes;
              reject(new ImagewayError('TIMEOUT', 'Transform queue deadline exceeded.', 504));
            }
          },
          Math.max(1, deadline - Date.now()),
        );
      });
    } else this.active++;
    let worker: Worker | undefined,
      reusable = false;
    try {
      invariant(Date.now() < deadline, 'TIMEOUT', 'Transform deadline exceeded in queue.', 504);
      worker = this.acquire();
      const current = worker;
      return await new Promise<TransformResult>((resolve, reject) => {
        const cleanup = () => {
          clearTimeout(timer);
          current.removeListener('message', message);
          current.removeListener('error', error);
          current.removeListener('exit', exit);
        };
        const exit = () => {
          cleanup();
          reject(new ImagewayError('WORKER', 'Image worker exited unexpectedly.', 500));
        };
        const error = (e: Error) => {
          cleanup();
          void current.terminate().then(() => reject(e));
        };
        const message = (result: {
          value?: TransformResult;
          error?: { code: string; message: string; status: number };
        }) => {
          cleanup();
          reusable = true;
          if (result.error)
            reject(new ImagewayError(result.error.code, result.error.message, result.error.status));
          else if (result.value) {
            const data = result.value.data;
            resolve({
              ...result.value,
              data:
                data.byteOffset === 0 && data.buffer.byteLength === data.byteLength
                  ? Buffer.from(data.buffer, 0, data.byteLength)
                  : Buffer.from(data),
            });
          } else reject(new ImagewayError('WORKER', 'Invalid worker response.', 500));
        };
        const timer = setTimeout(
          () => {
            cleanup();
            void current
              .terminate()
              .then(() =>
                reject(new ImagewayError('TIMEOUT', 'Image worker exceeded its deadline.', 504)),
              );
          },
          Math.max(1, deadline - Date.now()),
        );
        current.once('message', message);
        current.once('error', error);
        current.once('exit', exit);
        try {
          current.postMessage(task);
        } catch (e) {
          cleanup();
          void current.terminate().then(() => reject(e));
        }
      });
    } finally {
      if (worker && reusable && worker.threadId !== -1) this.retain(worker);
      const next = this.waiting.shift();
      if (next) {
        this.queuedBytes -= next.bytes;
        next.begin();
      } else this.active--;
    }
  }
}
const pools = new Map<number, TransformPool>();
/** Shared admission across per-import processors, rather than multiplying worker count for every import. */
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

import { Worker } from 'node:worker_threads';
import { availableParallelism } from 'node:os';
import { ImagewayError, invariant } from '../core/errors.js';
import type { TransformTask } from './pool.js';
import type { TransformResult } from './pipeline.js';

/** Private transport seam for deterministic lifecycle tests; not a package export. */
export interface BuildWorkerEndpoint {
  on(event: 'message', listener: (value: unknown) => void): unknown;
  on(event: 'error', listener: (error: Error) => void): unknown;
  on(event: 'exit', listener: (code: number) => void): unknown;
  removeAllListeners(event: string): unknown;
  postMessage(value: unknown): void;
  terminate(): Promise<number>;
  ref(): unknown;
  unref(): unknown;
}
interface Pending {
  resolve: (value: TransformResult) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}
/** Finite Vite builds only: bounded native parallelism in one owned worker.
 * A fatal worker failure stops co-located jobs; Vite already fails the build.
 * Public processors/runtime pools retain their existing per-job isolation. */
export class ViteBuildPool {
  private active = 0;
  private waiting: Array<() => void> = [];
  private pending = new Map<number, Pending>();
  private sequence = 0;
  private worker?: BuildWorkerEndpoint;
  private blocked?: BuildWorkerEndpoint;
  private exited = new WeakSet<BuildWorkerEndpoint>();
  private stopping?: Promise<void>;
  private idle?: ReturnType<typeof setTimeout>;
  constructor(
    private readonly concurrency: number,
    private readonly createWorker: () => BuildWorkerEndpoint = () =>
      new Worker(new URL('./build-worker.js', import.meta.url), {
        resourceLimits: { maxOldGenerationSizeMb: 64 },
      }),
    private readonly idleMs = 5000,
  ) {
    invariant(
      Number.isSafeInteger(concurrency) && concurrency > 0 && concurrency <= 32,
      'POOL',
      'Invalid build concurrency.',
    );
  }
  async run(_task: TransformTask): Promise<TransformResult> {
    void _task;
    throw new ImagewayError(
      'POOL_SCOPE',
      'The Vite build executor cannot admit runtime requests.',
      500,
    );
  }
  private async acquire(): Promise<void> {
    if (this.active >= this.concurrency)
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    else this.active++;
  }
  private release(): void {
    const next = this.waiting.shift();
    if (next) next();
    else this.active--;
    if (
      this.active === 0 &&
      this.pending.size === 0 &&
      this.worker &&
      !this.stopping &&
      !this.blocked
    ) {
      const current = this.worker;
      current.unref();
      this.idle = setTimeout(() => {
        if (this.worker === current && this.active === 0)
          void this.stop(current, new ImagewayError('WORKER', 'Idle build worker closed.', 500));
      }, this.idleMs);
      this.idle.unref();
    }
  }
  private async ensureWorker(deadline: number): Promise<BuildWorkerEndpoint> {
    if (this.stopping) await this.stopping;
    invariant(Date.now() < deadline, 'TIMEOUT', 'Build worker startup deadline exceeded.', 504);
    invariant(
      !this.blocked,
      'WORKER',
      'Build worker termination is unconfirmed; new transforms are disabled.',
      500,
    );
    if (this.idle) {
      clearTimeout(this.idle);
      this.idle = undefined;
    }
    if (!this.worker) {
      const current = this.createWorker();
      this.worker = current;
      current.on('message', (value) => this.receive(current, value));
      current.on('error', () => {
        void this.stop(current, new ImagewayError('WORKER', 'Image build worker failed.', 500));
      });
      current.on('exit', () => {
        this.exited.add(current);
        if (this.blocked === current) this.blocked = undefined;
        void this.stop(
          current,
          new ImagewayError('WORKER', 'Image build worker exited unexpectedly.', 500),
        );
      });
    }
    this.worker.ref();
    return this.worker;
  }
  private async stop(
    current: BuildWorkerEndpoint,
    reason: ImagewayError,
    failedId?: number,
  ): Promise<void> {
    if (this.worker !== current) return;
    if (this.stopping) return this.stopping;
    if (this.idle) {
      clearTimeout(this.idle);
      this.idle = undefined;
    }
    const jobs = [...this.pending];
    this.pending.clear();
    for (const [, job] of jobs) clearTimeout(job.timer);
    // Do not release any native permit or create a replacement until termination
    // has completed, including error, timeout and synchronous postMessage failure.
    this.stopping = Promise.resolve()
      .then(() => current.terminate())
      .then(
        () => true,
        () => this.exited.has(current),
      )
      .then((stopped) => {
        if (!stopped) {
          this.blocked = current;
          this.stopping = undefined;
          for (const [, job] of jobs)
            job.reject(
              new ImagewayError(
                'WORKER',
                'Build worker termination failed; new transforms are disabled until it exits.',
                500,
              ),
            );
          return;
        }
        current.removeAllListeners('message');
        current.removeAllListeners('exit');
        current.removeAllListeners('error');
        current.on('error', () => {});
        if (this.worker === current) this.worker = undefined;
        this.stopping = undefined;
        for (const [id, job] of jobs)
          job.reject(
            failedId === undefined || failedId === id
              ? reason
              : new ImagewayError(
                  'WORKER',
                  'Image build worker stopped after another task failed.',
                  500,
                ),
          );
      });
    return this.stopping;
  }
  private receive(current: BuildWorkerEndpoint, raw: unknown): void {
    if (this.worker !== current || this.stopping) return;
    if (
      !raw ||
      typeof raw !== 'object' ||
      !('id' in raw) ||
      !Number.isSafeInteger(raw.id) ||
      !this.pending.has(raw.id as number)
    ) {
      void this.stop(
        current,
        new ImagewayError('WORKER', 'Invalid image build worker response.', 500),
      );
      return;
    }
    const message = raw as {
      id: number;
      value?: TransformResult;
      error?: { code: string; message: string; status: number };
    };
    const job = this.pending.get(message.id)!;
    if (
      (message.error &&
        (typeof message.error.code !== 'string' ||
          typeof message.error.message !== 'string' ||
          !Number.isSafeInteger(message.error.status) ||
          message.error.status < 400 ||
          message.error.status > 599)) ||
      (!message.error && !(message.value?.data instanceof Uint8Array))
    ) {
      void this.stop(
        current,
        new ImagewayError('WORKER', 'Invalid image build worker payload.', 500),
      );
      return;
    }
    if (message.error) {
      this.pending.delete(message.id);
      clearTimeout(job.timer);
      job.reject(
        new ImagewayError(message.error.code, message.error.message, message.error.status),
      );
    } else {
      try {
        const value = message.value!,
          data = value.data;
        const result = {
          ...value,
          data:
            data.byteOffset === 0 && data.buffer.byteLength === data.byteLength
              ? Buffer.from(data.buffer, 0, data.byteLength)
              : Buffer.from(data),
        };
        this.pending.delete(message.id);
        clearTimeout(job.timer);
        job.resolve(result);
      } catch {
        void this.stop(
          current,
          new ImagewayError('WORKER', 'Invalid image build worker buffer.', 500),
        );
      }
    }
  }

  async runBuild(task: TransformTask): Promise<TransformResult> {
    await this.acquire();
    try {
      const deadline = Date.now() + task.config.timeoutMs + 1000;
      let startupTimer: ReturnType<typeof setTimeout> | undefined;
      const current = await Promise.race([
        this.ensureWorker(deadline),
        new Promise<never>((_resolve, reject) => {
          startupTimer = setTimeout(
            () =>
              reject(new ImagewayError('TIMEOUT', 'Build worker startup deadline exceeded.', 504)),
            Math.max(1, deadline - Date.now()),
          );
        }),
      ]).finally(() => {
        if (startupTimer) clearTimeout(startupTimer);
      });
      invariant(
        this.worker === current && !this.stopping && !this.blocked,
        'WORKER',
        'Image build worker stopped before dispatch.',
        500,
      );
      invariant(
        Date.now() < deadline,
        'TIMEOUT',
        'Build transform deadline exceeded before dispatch.',
        504,
      );
      do {
        this.sequence = this.sequence >= Number.MAX_SAFE_INTEGER ? 1 : this.sequence + 1;
      } while (this.pending.has(this.sequence));
      const id = this.sequence;
      return await new Promise<TransformResult>((resolve, reject) => {
        const timer = setTimeout(
          () => {
            void this.stop(
              current,
              new ImagewayError('TIMEOUT', 'Image build worker exceeded its deadline.', 504),
              id,
            );
          },
          Math.max(1, deadline - Date.now()),
        );
        this.pending.set(id, { resolve, reject, timer });
        try {
          current.postMessage({ id, task });
        } catch {
          void this.stop(
            current,
            new ImagewayError('WORKER', 'Could not dispatch image build task.', 500),
            id,
          );
        }
      });
    } finally {
      this.release();
    }
  }
}
const pools = new Map<number, ViteBuildPool>();
export function sharedViteBuildPool(
  concurrency = Math.max(1, Math.min(2, availableParallelism() - 1)),
): ViteBuildPool {
  let pool = pools.get(concurrency);
  if (!pool) {
    pool = new ViteBuildPool(concurrency);
    pools.set(concurrency, pool);
  }
  return pool;
}

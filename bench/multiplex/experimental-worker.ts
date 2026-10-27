// Success-path experiment only. Co-located deadline/error isolation is deliberately
// not implemented: this adapter must never ship in the consumer package.
import { EventEmitter } from 'node:events';
import { Worker as NativeWorker, type WorkerOptions } from 'node:worker_threads';
interface Shard {
  worker: NativeWorker;
  pending: Map<number, Worker>;
  members: Set<Worker>;
  next: number;
}
let shard: Shard | undefined;
export class Worker extends EventEmitter {
  private readonly owner: Shard;
  private leased = true;
  constructor(_url: URL, options: WorkerOptions) {
    super();
    if (!shard || shard.worker.threadId === -1) {
      const worker = new NativeWorker(
        new URL('./experimental-sharp-worker.js', import.meta.url),
        options,
      );
      const current: Shard = { worker, pending: new Map(), members: new Set(), next: 0 };
      shard = current;
      worker.on('message', (message: { id: number; value?: unknown; error?: unknown }) => {
        const target = current.pending.get(message.id);
        if (!target) throw Error('Unknown experimental response');
        current.pending.delete(message.id);
        const { id: unused, ...result } = message;
        void unused;
        target.emit('message', result);
      });
      worker.on('error', (error) => {
        for (const target of current.members) target.emit('error', error);
      });
      worker.on('exit', (code) => {
        if (shard === current) shard = undefined;
        for (const target of current.members) target.emit('exit', code);
      });
    }
    this.owner = shard;
    this.owner.members.add(this);
    this.owner.worker.ref();
  }
  get threadId() {
    return this.owner.worker.threadId;
  }
  postMessage(task: unknown) {
    const id = ++this.owner.next;
    this.owner.pending.set(id, this);
    this.owner.worker.postMessage({ id, task });
  }
  ref() {
    this.leased = true;
    this.owner.worker.ref();
    return this;
  }
  unref() {
    this.leased = false;
    if (![...this.owner.members].some((x) => x.leased)) this.owner.worker.unref();
    return this;
  }
  terminate() {
    this.owner.members.delete(this);
    if (this.leased || this.owner.members.size === 0) return this.owner.worker.terminate();
    return Promise.resolve(0);
  }
}

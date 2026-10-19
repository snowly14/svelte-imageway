interface KV {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
}
interface Storage extends KV {
  transaction<T>(callback: (transaction: KV) => Promise<T>): Promise<T>;
}
interface Selection {
  kind: 'key' | 'prefix' | 'tag';
  value: string;
  version: number;
}
/** Shared account admission and logical key/prefix/tag invalidation in a Durable Object. */
export class ImageBudget {
  constructor(private readonly state: { storage: Storage }) {}
  async fetch(request: Request): Promise<Response> {
    const text = await request.text();
    if (request.method !== 'POST' || text.length > 8192)
      return new Response('Invalid budget request', { status: 400 });
    const input = JSON.parse(text) as {
      op: 'state' | 'purge';
      key?: string;
      tags?: string[];
      kind?: Selection['kind'];
      value?: string;
      consume?: 'request' | 'transform';
      rateLimit?: number;
      transformLimit?: number;
      monthlyLimit?: number;
    };
    return this.state.storage.transaction(async (storage) => {
      const now = Date.now();
      if (input.consume) {
        const period = input.consume === 'request' ? 60_000 : 3600_000;
        const window = Math.floor(now / period);
        const stored = await storage.get<{ window: number; count: number }>(input.consume);
        const counter = stored?.window === window ? stored : { window, count: 0 };
        const limit =
          input.consume === 'request' ? (input.rateLimit ?? 1000) : (input.transformLimit ?? 10000);
        if (!Number.isSafeInteger(limit) || limit < 1 || ++counter.count > limit)
          return Response.json({ error: 'BUDGET' }, { status: 429 });
        if (input.consume === 'transform') {
          const month = new Date(now).toISOString().slice(0, 7);
          const previous = await storage.get<{ month: string; count: number }>('month');
          const monthly = previous?.month === month ? previous : { month, count: 0 };
          const monthlyLimit = input.monthlyLimit ?? 4000;
          if (
            !Number.isSafeInteger(monthlyLimit) ||
            monthlyLimit < 1 ||
            ++monthly.count > monthlyLimit
          )
            return Response.json({ error: 'MONTHLY_BUDGET' }, { status: 429 });
          await storage.put('month', monthly);
        }
        await storage.put(input.consume, counter);
      }
      const namespace = (await storage.get<number>('namespace')) ?? 0;
      const selections = (await storage.get<Selection[]>('selections')) ?? [];
      if (input.op === 'purge') {
        if (
          !['key', 'prefix', 'tag'].includes(input.kind ?? '') ||
          !/^[\w./-]{1,1024}$/.test(input.value ?? '')
        )
          return new Response('Invalid purge selection', { status: 400 });
        const found = selections.find((v) => v.kind === input.kind && v.value === input.value);
        if (!found && selections.length >= 64)
          return Response.json(
            {
              error: 'PURGE_CAPACITY',
              message:
                'Purge selection history is full; explicitly reset the namespace during maintenance.',
            },
            { status: 429 },
          );
        if (found) found.version++;
        else selections.push({ kind: input.kind!, value: input.value!, version: 1 });
        const scope: string = input.kind!;
        await storage.put('namespace', namespace);
        await storage.put('selections', selections);
        return Response.json({ invalidated: true, scope });
      }
      if (input.op !== 'state' || typeof input.key !== 'string')
        return new Response('Invalid state request', { status: 400 });
      const matching = selections.filter((v) =>
        v.kind === 'key'
          ? input.key === v.value
          : v.kind === 'prefix'
            ? input.key!.startsWith(v.value)
            : input.tags?.includes(v.value),
      );
      return Response.json({ version: JSON.stringify([namespace, matching]) });
    });
  }
}

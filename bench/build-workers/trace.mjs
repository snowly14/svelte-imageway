// Untimed diagnostic only. Workers inherit --import; no instrumentation in timed runs.
import sharp from 'sharp';
import { threadId } from 'node:worker_threads';
import { appendFileSync } from 'node:fs';
const file = process.env.IMAGEWAY_TRACE_FILE;
if (file) {
  for (const method of ['metadata', 'toBuffer', 'stats']) {
    const original = sharp.prototype[method];
    sharp.prototype[method] = function (...args) {
      const started = performance.now();
      const inputBytes = this.options.input.buffer?.length;
      const value = Reflect.apply(original, this, args);
      if (value?.then)
        return value.finally(() =>
          appendFileSync(
            file,
            JSON.stringify({
              threadId,
              method,
              started,
              elapsedMs: performance.now() - started,
              inputBytes,
              resizeWidth: this.options.width,
              resizeHeight: this.options.height,
            }) + '\n',
          ),
        );
      return value;
    };
  }
  appendFileSync(
    file,
    JSON.stringify({ threadId, method: 'preload', started: performance.now() }) + '\n',
  );
}

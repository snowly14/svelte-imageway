import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { digest } from '../photographic/common.ts';
const root = process.argv[2]!;
const start = performance.now();
const { page } = (await import(pathToFileURL(join(root, 'ssr/entry.js')).href)) as {
  page: () => { body: string; head: string };
};
const initializedMs = performance.now() - start,
  firstStart = performance.now(),
  first = page(),
  firstBatchMs = performance.now() - firstStart;
for (let i = 0; i < 100; i++) page();
let checksum = 0;
const cpu = process.cpuUsage(),
  timed = performance.now();
for (let i = 0; i < 500; i++) {
  const result = page();
  checksum += result.body.length + result.head.length;
}
const elapsedMs = performance.now() - timed,
  usage = process.cpuUsage(cpu);
console.log(
  JSON.stringify({
    perRenderMs: elapsedMs / 500,
    cpuMicrosecondsPerRender: (usage.user + usage.system) / 500,
    initializationMs: initializedMs,
    firstBatchMs,
    checksum,
    digest: digest(JSON.stringify(first)),
    peakRssBytes: process.resourceUsage().maxRSS * 1024,
    node: process.version,
  }),
);

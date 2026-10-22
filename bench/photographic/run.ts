import { prepare, environment, save } from './common.ts';
import { builds } from './build.ts';
import { quality } from './quality.ts';
import { browserBench } from './browser.ts';

await prepare();
const stage = process.argv[2];
if (stage && !['build', 'quality', 'browser'].includes(stage))
  throw Error('Expected build, quality or browser.');
await save('environment', await environment());
if (!stage || stage === 'build') await builds();
if (!stage || stage === 'quality') await quality();
if (!stage || stage === 'browser') await browserBench();

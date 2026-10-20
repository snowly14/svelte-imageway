import { imageHandle } from 'svelte-imageway/kit';
import config from '../imageway.config.ts';
import { resolve } from 'node:path';
export const handle = imageHandle({
  config,
  sourceRoot: process.env.IMAGEWAY_SOURCE_ROOT ?? resolve('static'),
  publicSources: true,
});

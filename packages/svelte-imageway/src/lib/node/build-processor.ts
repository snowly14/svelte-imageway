import { ImageProcessor } from './processor.js';
import { sharedViteBuildPool } from './build-pool.js';
type Options = ConstructorParameters<typeof ImageProcessor>[0];
/** Internal Vite-only specialization; direct processors retain their old pools. */
class ViteBuildProcessor extends ImageProcessor {
  constructor(options: Options) {
    super({ ...options, build: true });
    this.pool = sharedViteBuildPool(options.concurrency);
  }
}
export function createViteBuildProcessor(options: Options): ImageProcessor {
  return new ViteBuildProcessor(options);
}

/** A stable public error without upstream URLs, credentials, or decoder stacks. */
export class ImagewayError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400) {
    super(message);
    this.name = 'ImagewayError';
  }
}
/** Assert an invariant and return an actionable contract error. */
export function invariant(condition: unknown, code: string, message: string, status = 400): asserts condition {
  if (!condition) throw new ImagewayError(code, message, status);
}

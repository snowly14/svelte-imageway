/**
 * The 3.1.9 processing tree differs from 3.1.8 only by avoiding an unused
 * preview clone. Its validation, output and cached metadata are equivalent.
 * Match the entire processing-source SHA-256, not a version or prefix: any
 * other source change automatically gets its own cache revision.
 */
const reviewedImplementation = 'e3c96d43f9d137a68e28d89852216013ea7cb0f1868dc184df2a4331b380b03a';
const compatibleRevision = 'b20ae906366d6af637b09e1d0f745f64638c030dfb49e3f5efab67454b7ad77f';
export function cacheRevision(implementation: string): string {
  return implementation === reviewedImplementation ? compatibleRevision : implementation;
}

# ADR 0002: Bounded v1 requests and explicit representation identity

- Date: 2026-10-19
- Status: Proposed; conformance implementation and machine schemas belong to M1

## Decision

Use `/_img/v1` with a validated query contract. Exactly one of `url` and `key` identifies a source. Every provider accepts the same normalized request object and either maps the requested operations faithfully, invokes a documented degradation policy, or fails with an actionable capability error.

Default to explicit output format URLs. Support `format=auto` only where the transport negotiates an allowed representation and includes that representation in its bounded cache identity. A `Vary` header alone does not configure a CDN cache policy.

Normalization rejects duplicate/unknown parameters and invalid encodings, canonicalizes safe numerical/enum forms, applies configured width/quality ladders and serializes sorted parameters. Do not alter the meaning of signed upstream query strings. The source's authorization/tenant context, revision, pipeline version and representation are part of cache identity, though not all are public query fields.

HMAC signs the version, endpoint, key ID, expiration and canonical request, excluding `sig`. Verification checks raw request validity, bounds, signature and expiration before serving any cached bytes. Expiration is not replaced by the transform cache's TTL. Rotation accepts explicitly configured current/previous keys; key IDs are public identifiers and secrets are server-only.

For private output, default to private/no-store; a shared public CDN can otherwise bypass origin expiration checks on a hit. A public signed transformation is not necessarily private access control. Document the difference.

## Alternatives rejected

- Raw query strings as cache keys: reordering/aliases and arbitrary widths explode variants.
- Signing an unnormalized request then normalizing separately: parser ambiguity creates signature and cache inconsistencies.
- Sorting or deleting arbitrary upstream source query parameters: can invalidate CMS/cloud signatures.
- Immutable caching for every signed URL: a valid signature proves authorization/integrity, not source immutability.
- Vendor-specific component props as the default abstraction: switching providers would require component rewrites.

## Consequences

The [draft specification](../spec/url-contract.md) defines the planned vocabulary and algorithm. M1 must add JSON Schema/OpenAPI, canonical byte-level vectors, signature vectors, malformed query tests, preset expansion tests, expiry tests, rotation tests, and variant cardinality tests before changing this ADR to Accepted.

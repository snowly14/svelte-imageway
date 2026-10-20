# Universal URL contract: v1 design draft

Status: v1 parser, signer, JSON Schema and OpenAPI implemented; pre-release compatibility is covered by executable contract tests. Platform policy and network checks remain separate from structural schemas. Unknown or unsupported operations fail explicitly.

## Endpoint and sources

Canonical service endpoint: `/_img/v1`. The Kit integration may offer `/_img` as a compatibility entry, but generated URLs include the version. Only GET and HEAD image retrieval are in this contract; purge/metrics/health are separate authenticated or explicitly exposed endpoints.

Exactly one source is required:

- `url`: absolute HTTPS URL on an explicit origin allowlist. Reject credentials, fragments, unsafe ports and disallowed destinations at every redirect/connection. Source query content remains intact.
- `key`: opaque object key resolved inside a configured source namespace. It is not an arbitrary local filesystem path. Resolve local keys with realpath containment; reject traversal and symlink escapes.

No wildcard public proxy is a default. A component's unrecognized remote URL may remain an unoptimized public URL; requesting a transformation requires a configured provider/security policy.

## Parameter vocabulary

All ranges below are proposed safe defaults, configurable only server-side within backend limits. Machine schemas must express the structural constraints; semantic/preset/network constraints require runtime checks.

| Parameter     | Type / values                                                 | Proposed semantics                                                                                            |
| ------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `url` / `key` | string, mutually exclusive                                    | Source identity; source URL preserves signed query semantics                                                  |
| `w`, `h`      | integer 1–4096                                                | Logical target box dimensions; at least one dimension or a preset is needed for dynamic transforms            |
| `dpr`         | 1, 1.5, 2, 3                                                  | Multiply logical dimensions, with decoded/output limits checked on physical pixels                            |
| `q`           | integer 1–100                                                 | Quantized quality ladder; quality scales differ by encoder/provider                                           |
| `format`      | `avif`, `webp`, `jpeg`, `png`, `gif`, `svg`, `auto`           | Canonical `jpeg`; import-side `jpg` is normalized to `jpeg`; SVG restricted to approved processing paths      |
| `fit`         | `cover`, `contain`, `fill`, `inside`, `outside`, `scale-down` | Transform semantics, separate from CSS object-fit; provider support checked                                   |
| `position`    | `center`, cardinal/corner anchors, `attention`, `entropy`     | Crop focus; smart crop is capability-gated                                                                    |
| `blur`        | number 0–20                                                   | Zero disables; positive sigma/backend mapping must be documented                                              |
| `sharpen`     | number 0–10                                                   | Zero disables; map only where semantics are supported                                                         |
| `bg`          | `transparent` or lowercase 6/8-digit hex without `#`          | Padding/flattening color, including alpha if supported                                                        |
| `rotate`      | 0, 90, 180, 270                                               | Clockwise rotation after EXIF auto-orientation                                                                |
| `flip`        | `none`, `horizontal`, `vertical`, `both`                      | Explicit axis mapping; no ambiguous vendor flip names                                                         |
| `metadata`    | `none`, `icc`, `safe`                                         | Default none; ICC preserves color profile only. Safe metadata allowlist must exclude GPS and identifying EXIF |
| `animation`   | `preserve`, `first`                                           | Default preserve when supported; do not silently flatten animation                                            |
| `preset`      | `thumb`, `card`, `hero`, `og`, configured safe name           | Server-defined restricted recipe with versioned policy                                                        |
| `rev`         | restricted string                                             | Trusted source revision/content identity; arbitrary user text alone does not prove immutable content          |
| `kid`         | restricted public key identifier                              | Select configured HMAC key; never a key or arbitrary environment-variable name                                |
| `exp`         | integer Unix seconds                                          | Required when signing; bounded maximum lifetime and configured clock skew                                     |
| `sig`         | unpadded base64url HMAC-SHA256                                | Server-generated signature over the canonical signing payload                                                 |

Omitted defaults normalize to explicit internal values; generated URLs consistently materialize and include stable defaults. Unknown query names, duplicate keys, NaN, Infinity, empty required fields, invalid UTF-8/percent encodings and noncanonical ambiguous boolean spellings are rejected. Never coerce a malformed value to a permissive default.

Proposed width ladder: 320, 480, 640, 768, 960, 1280, 1600, 1920, 2560. Proposed quality ladder: 50, 65, 75, 85, 95. Defaults: quality 75, DPR 1, fit inside, position center, no metadata. Exact ladders and final range enforcement must be fixed by M1 tests. Static source dimensions clamp generated variants without upscaling.

## Normalization algorithm

1. Parse a single query representation with strict encoding validation; reject duplicate and unknown fields before building a map.
2. Validate source syntax, source namespace and bounds. Network resolution/connection validation remains mandatory at fetch time.
3. Expand the selected preset using its immutable policy revision. Reject overrides outside its locked fields/ranges.
4. Canonicalize enum aliases, decimal number spelling, background color and logical width/quality buckets. Use the smallest permitted bucket greater than or equal to the requested value; reject values above the configured maximum. Enforce physical dimensions and total pixels after DPR.
5. Keep the upstream source URL's query sequence, encoding meaning and credentials policy intact. Encode it once as a query value; never recursively decode it. Do not reorder its signed parameters.
6. Sort canonical outer parameter names by ASCII order. Percent-encode UTF-8 bytes using RFC 3986 unreserved characters, `%20` for spaces, uppercase hexadecimal escapes. Emit each key exactly once.
7. Sign or verify the payload described below. Validate authorization and expiry before cache lookup.
8. Resolve `auto` against supported encoders and Accept preferences, respecting media-range q=0 and q-values. Save-Data may select only a bounded, policy-approved quality bucket; Client Hints are opt-in and similarly bucketed.
9. Derive the transform cache identity from source namespace/tenant, verified revision or revalidation policy, normalized transformations, negotiated output MIME, preset/pipeline/codec version and metadata policy. Auth fields can be omitted from stored transform identity only after authorization succeeds and isolation is preserved.

The canonical byte string, normalized object and cache identity are distinct concepts with shared normalization. No locale-aware sorting, floating-point string surprises or raw Accept strings belong in cache identity. M1 must supply byte-level expected vectors for this algorithm.

## Signatures and expiry

Proposed signing payload is four UTF-8 lines without a trailing newline: method `GET`, normalized endpoint path, protocol/policy identifier `v1:<preset revision>` (or `v1:-` without a preset), sorted encoded request excluding `sig`. It includes `kid`, `exp`, source, all output-affecting fields and relevant preset revision. HEAD is authorized using the same GET payload and cannot change the output contract. Use HMAC-SHA256, unpadded base64url output and constant-time comparison over fixed-size decoded bytes.

Reject missing/unknown key IDs, invalid signature encoding/length, expired or implausibly distant expiry, duplicate parameters and altered values. Configure current/previous key IDs for rotation with bounded overlap. Error responses and logs must not print secrets or private source query credentials.

Private content defaults to private/no-store; a CDN must not serve it past access expiry without validating at the edge. Public signed transform URLs may share decoded artifacts if policy allows, but signing alone does not justify `immutable`.

## Format modes and cache semantics

Explicit format is recommended for build assets, `<picture>` sources, preloads and most CDN configurations. MIME must match the actual encoder output; do not declare `image/avif` and serve WebP bytes as an invisible fallback.

Negotiated `format=auto` chooses among supported, acceptable encoders, with AVIF/WebP preferred only when allowed by Accept and platform limits. Include output format in internal cache identity and send `Vary: Accept`. If Save-Data or hints affect output, either redirect/rewrite to an explicit canonical variant or vary on the exact bounded inputs at every downstream cache.

Content-addressed public build assets can use `public, max-age=31536000, immutable`. Mutable remote sources use bounded TTL, validators and optional stale-while-revalidate. ETags identify output bytes. Implement correct conditional GET/HEAD and 304 behavior. Byte ranges are advertised only for finalized cached bytes where correct range responses are implemented; otherwise use `Accept-Ranges: none` or omit it.

See [CDN-specific cache guidance and pending verification](../research/platforms-and-costs.md#negotiated-cache-configuration).

## Error model

Proposed errors: 400 malformed request, 401 invalid/missing required signature, 403 disallowed origin/preset, 404 missing approved key, 406 no acceptable supported format, 413 byte/pixel/output limit, 415 unsupported/unsafe input, 422 unsupported transformation capability, 429 rate/budget limit, 502 approved origin/decoder failure and 504 timeout. Never fall back across a security rejection.

Machine-readable errors should use a stable code and an actionable public message without source secrets or stack traces. Correlate with a nonidentifying request ID and optional structured logs.

## Presets and variant bounds

Proposed preset purposes: thumb (small square crop), card (bounded responsive content), hero (larger responsive image), og (1200×630 social output). Store their exact dimensions/format/quality/override policy in the central config; do not bake conflicting definitions into providers.

Bound widths, qualities, DPR, crop policies, animation pages, simultaneous jobs and queued requests. The variant cardinality test must compute the product of allowed combinations for each exposed preset, prove deduplication of equivalent physical output dimensions, and reject arbitrary dimensions. LRU eviction alone does not prevent variant-generation abuse.

## M1 conformance deliverables

- Markdown plus JSON Schema and OpenAPI for request/error shapes.
- Canonicalization, reserved characters, signed upstream URLs, aliases and duplicate-key vectors.
- HMAC/expiry/key-rotation vectors and verification-before-cache regression tests.
- Accept q-value parsing and format-key isolation vectors.
- Preset locks, DPR bounds, variant cardinality and pipeline-version cache invalidation tests.
- Node source acquisition tests covering traversal, encoded IPs, DNS rebinding, redirects, body limits and timeout.

No schema or wire-compatibility promise is made until those deliverables are executed and reviewed.

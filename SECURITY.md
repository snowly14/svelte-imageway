# Security policy and threat model

This is a 0.1.0 preview. Do not deploy an open unrestricted optimizer. A package is not a managed security perimeter or a CDN. Review deployment limits and trust boundaries before exposing the service.

## Reporting

No public repository/security contact has been configured yet. Until a maintainer adds their verified private security channel, do not publish exploit details or credentials in public issues. The release procedure requires a repository with private vulnerability reporting enabled. Supported preview line: latest 0.1.x; fixes may change behavior that relied on unsafe inputs. Production security review remains an operator responsibility.

## Assets, attackers and trust

Protect source confidentiality, filesystem contents, origin credentials, CPU/memory and paid image transformations. Attackers may control image query strings and uploaded media. Operators control source roots, allowlists, provider configuration, signing keys, storage credentials, cache directories and proxy/CDN rules. Source-root and cache-directory writers are trusted: Node's realpath + final O_NOFOLLOW does not sandbox a hostile concurrent filesystem administrator changing parent directories. Restrict filesystem ownership, mount sources read-only and isolate the service/container.

## Source policy

Node remote fetch requires exact HTTPS origin allowlisting, port 443, no URL credentials/hash. Every redirect is reauthorized, at most three. All A/AAAA results must be public; IPv4-mapped IPv6, private/reserved/link-local/metadata ranges are blocked. The vetted address is pinned into the actual TLS lookup while preserving the original hostname/certificate check. DNS, transport and stream read share a deadline. Cookies, Authorization and client headers are not forwarded. Responses use identity encoding and bounded bytes; input MIME is determined from content. Do not replace the transport with an unchecked ambient fetch.

The Worker accepts approved R2 key prefixes only. It cannot guarantee DNS pinning in Workers fetch, so it does not expose an arbitrary remote-image proxy. Optional cf.image uses an operator-owned public origin serving the same immutable keys and refuses redirects; that origin-to-R2 content equivalence is an explicit operator trust boundary.

Local keys reject traversal, absolute paths, empty/dot segments and non-ASCII path metacharacters. realpath must remain under the configured root; the final open uses O_NOFOLLOW. Missing or oversized sources fail closed.

## Authorization and cache

Unsigned requests need a locked preset by default. Arbitrary transforms require server-generated HMAC-SHA256 (32-byte minimum secret), expiration and key ID. Rotate with current/previous environment keys; remove previous only after existing links expire. A present invalid signature field is never treated as an unsigned request. Authorization is verified before shared-cache reuse. Preset revisions and normalized defaults participate in the signature and representation identity. Use short lifetimes; maximum verification lifetime is 24 hours by default. Never put secrets in VITE_* variables or browser config.

Private is the response default (`private, no-store`). Only explicitly public sources may use public cache headers. Signed public responses clamp max-age to the remaining signature lifetime and omit stale-while-revalidate/immutable; a CDN must honor that TTL and not serve stale past expiry. Hash-revision unsigned public URLs may be immutable only after verifying the input content hash. Signature alone is not content immutability. The CDN cache key must retain all transform/source/query authorization fields; do not strip signature fields at the external CDN. Internal format cache keys normalize Accept/Save-Data and exclude authorization only after origin verification. Do not share a cache across tenants with different source authorization policies unless using an explicit namespace and equivalent policy.

ETag does not authorize access. Invalid/expired requests cannot get 304. Negative errors are no-store. Purge and metrics use separate 32-byte bearer secrets with constant-time HMAC/timing-safe checks. Logs contain code/status/duration, not client IP or source query. Purge affects origin generations; CDN copies need their own purge or expiry. Logical Worker selector history is bounded (64 distinct selectors); plan broad stable prefixes/tags, and perform an explicit namespace/cache maintenance reset if capacity is reached.

## Decoder/resource policy

Sharp runs in bounded worker_threads with shared admission across imports/processors, queue byte/count limits, input/output bytes, physical dimensions, total decoded pixels/frames, frame count <=100, timeout/worker termination, EXIF/GPS stripping and opt-in ICC only. Node service caps concurrent requests at eight. Workers default to 8 MB input/output, 16 MP total decoded frames, one transform at a time and at most 16 queued tasks. Worker GIF/WebP/APNG container frame counts are inspected before native decode; AVIF sequences are rejected. Native cloud operations may continue after a response timeout: admission guards limit accepted work, not an account-wide dollar spend. Set provider billing alerts and platform limits separately. Native allocations are not limited by JavaScript heap settings; container memory/CPU limits are the final boundary. Unsupported exotic codecs fail explicitly; no automatic unbounded WASM decoder is used.

SVG is a strict geometry-only XML dialect, validated with a pinned SAX parser. No namespaces/prefixed active elements, scripts, foreignObject, external/internal references, CSS escapes, styles, event handlers, text, DTD/entities, processing instructions or CDATA. Depth <=32, elements <=10,000. Runtime raw SVG output is disabled; approved build SVG can be optimized and emitted as an image. Serve SVG on a cookieless asset origin with `Content-Type: image/svg+xml`, nosniff and CSP `default-src 'none'; style-src 'none'; sandbox`. The XML parser is pinned saxes 6.0.0 (upstream archived): monitor advisories/replacement; validation adds its own small whitelist and resource limits.

## Supply chain and operations

No telemetry. Wrangler metrics are disabled in the local verification commands, but the external CLI has its own policy. Package files exclude local secrets, originals and credentials. Browser bundle scanning rejects Node/Sharp/filesystem/storage SDK leakage. Publication SDKs are optional build-only peers. Production containers are non-root, read-only, cap_drop ALL, no-new-privileges and bounded. Restrict /metrics and /purge at the CDN as defense in depth. Protect the Docker socket, CI provenance permissions and storage token scope. Keep Sharp/libvips and platform runtimes updated, and rerun the negative-input suite after upgrades. This repository's tests do not replace a third-party penetration test.

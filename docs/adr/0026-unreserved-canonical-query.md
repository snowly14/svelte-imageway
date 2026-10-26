# 0026 — Canonical query encoding without redundant URI work

Date: 2026-10-26

Status: Accepted after measured comparisons and compatibility tests; release-source CI remains required.

## Profile and selected change

An untimed mapped-provider Node profile attributes the largest main-thread self samples to the RFC3986 encoder. Each normalized query repeatedly URI-encodes field names, numbers and enum tokens even when they contain only unreserved ASCII characters. Native encodeURIComponent and punctuation replacement remain necessary for other values.

The encoder now returns an already-safe string unchanged only when a negative ASCII character test finds nothing outside letters, digits, underscore, dot, tilde and hyphen. A negative test is intentional: an anchored `$` pattern can match before a final newline. Reserved characters, control characters, Unicode and malformed UTF16 continue through the original native encoder and punctuation escaping. Lone surrogates retain URIError behavior. No normalizer or security check is removed.

Canonical query assembly keeps Object.entries value capture and UTF16 lexical key ordering, but uses one sorted traversal and concatenation instead of allocating intermediate filter/map arrays. Undefined values and optional signature omission retain their exact behavior, including arbitrary utility keys and getter/coercion order. Signing, representation identities, presets, source validation and provider contracts remain byte-compatible.

## Rejected variants and costs

The first experiment also precomputed the private normalization enum-entry table. Its normalization median did not improve, so that change was removed; the final normalizeRequest body is unchanged. All initial data and a source patch matching the recorded diff fingerprint remain available.

A separate selection study compares the chosen loop/fast encoder against the original pipeline with only the fast encoder. The latter saves less provider CPU and does not improve the sampled prepared-cache median. The selected version improves complete provider/JSON and prepared-memory-cache workloads, but **cache process peak RSS grows about 6.2 MiB** and configured-provider client pages grow **19–25 gzip bytes**. These are accepted measured costs, not a claim that every metric improves. No ownership copies, admission limits, deadlines or GC settings are weakened to win the benchmark.

## Scope, native boundaries and validation

This is shared portable URL code. The reserved-string path still uses the engine's native URI encoder; the improvement avoids work rather than replacing an image codec. No new Rust surface, browser WASM, consumer compiler or native build step is introduced, and no unmeasured Rust/FFI advantage is claimed. The existing fixed-memory preview artifact remains unchanged.

Differential gates cover every ASCII/Latin1 character, control/trailing line breaks, Unicode, malformed surrogate errors, unknown and Unicode keys, signature exclusion, 1024 seeded requests and getter coercion. Existing signature, provider, parser, normalization and ownership tests remain required. Timed suites retain initial/final/selection periods separately, complete byte identities, CPU/wall time, process RSS and browser JS+CSS. Generic component entries remain above the 2000-byte goal. Native encoding/build/HTTP/cloud leadership is not established. See the dated benchmark report and REPORT.md.

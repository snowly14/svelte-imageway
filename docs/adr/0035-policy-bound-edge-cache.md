# ADR 35: Bind Edge cached outputs to their owned security policy

Status: accepted in 3.1.10. Date: 1 November 2026.

The portable Worker previously keyed outputs by processing revision and normalized request. A deployment reducing its source-byte, pixel or output-byte limits could still hit an output created under its preceding looser configuration. A regression with a shared cache reproduces a 200 response where the new one-byte output limit should return 413.

Include a SHA-256 fingerprint of the complete owned, deep-frozen ImageConfig in a new `edge-v2` cache namespace. Compute the fingerprint lazily once per Worker instance, sharing the promise across concurrent requests. Normalized requests and processing revision remain key inputs. Existing authorization, budget, expiry and purge checks continue per request. No keys or credentials are exposed: the final cache identity remains hashed. Binding/environment authorization remains independent of this public configuration fingerprint.

Legacy Edge keys are invalidated by the new namespace, including if a separately reviewed Node-output revision remains compatible. Identical owned policies share cache entries across Worker instances; different input-byte/pixel/output-byte limits cannot reuse them. Regression tests cover all three limits using a shared cache, unchanged-policy hits, and seeded legacy cache responses. The native platform is stubbed in pixel/input boundary tests; no paid cloud deployment or HTTP performance gain is claimed.

The invalidation is conservative: changing other configuration fields also misses the old cache. This accepts extra misses in exchange for a clear owned-policy boundary. Hashing uses the runtime's native WebCrypto; adding Rust/FFI would not improve this once-per-instance operation. No public API or consumer build step changes.

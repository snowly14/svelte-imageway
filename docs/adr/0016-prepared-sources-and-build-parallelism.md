# 0016 — Owned source snapshots and bounded build parallelism

Date: 2026-10-21

Status: Accepted subject to the recorded validation and paired measurements.

## Context

The HTTP service already caches sources for 60 seconds. Its byte cache defensively copied each source on every hit, and ImageProcessor hashed the full source again for every representation lookup. These operations scale with source size even when the encoded response is already cached.

Finite Vite builds used the runtime default of at most two workers. Native encoding already uses Sharp/libvips and its native codecs; adding another Rust/C++ wrapper would not by itself remove source copies, hashing or scheduling costs.

## Decision

ImageProcessor.prepare copies a source once and returns a frozen, typed capability containing its byte length, digest and process method. Source bytes stay inside the closure; callers cannot mutate the owned snapshot. The existing process API continues to hash current input content. Cached encoded outputs still use defensive copies.

The HTTP service caches these opaque prepared sources in an LRU bounded by the existing source byte budget and 4096 entries. Its original absolute 60-second source TTL remains unchanged; reads do not extend it. Authentication, revision matching, source authorization, transform limits, request admission and cache policy still run as before.

Finite Vite builds default to min(4, availableParallelism() - 1), with a minimum of one. The existing concurrency option overrides this. Dev/runtime defaults stay unchanged. Four active workers can consume more memory than two; this is an explicit throughput/memory tradeoff, not an unchanged RSS claim. Each job retains its decoder limits and terminating worker deadline. No global Sharp or UV_THREADPOOL_SIZE settings are mutated.

## Evidence and boundaries

Tests exercise source mutation after preparation, output mutation after cache reuse, original source expiry, byte/count eviction, signatures, resource policy and actual native processing. Paired HTTP measurements alternate baseline/current fresh processes and verify every response digest. Build measurements also verify byte-identical image outputs. A busy desktop is not a controlled lab: report medians and sample ranges and do not claim market-wide leadership, production CDN results or equal perceptual quality between unrelated encoder configurations.

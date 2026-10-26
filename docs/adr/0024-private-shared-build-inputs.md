# 0024 — Private shared build inputs

Date: 2026-10-26

Status: Accepted after local measurements and validation; exact release-source CI is required before publication.

## Problem and profiling

Cold responsive builds submit the same encoded source for several representations. A prepared source already owns one copied snapshot and one digest. Ordinary worker structured cloning then copies that snapshot for every admitted representation. Untimed instrumentation of the pinned 24-photo, three-width workload records 24 main-thread metadata requests, 72 worker metadata requests and 72 worker encodes, submitting 46,182,915 encoded input bytes to workers. These are operation counts, not proof of repeated full decodes. The main-thread profile spends most samples waiting for asynchronous native work; its samples do not profile libvips threads or separate resize/encode/decode CPU.

Seven cold/warm rounds with explicitly configured one/two/four workers are measured before modifying product code. Four retains the fastest photographic cold median but has the highest RSS. The existing default and explicit concurrency API remain unchanged.

## Decision

Only `ImageProcessor` instances with the existing finite-build mode enabled prepare their owned snapshot in an exact-sized `SharedArrayBuffer`, using Node's existing memory/worker primitives. They copy caller bytes once before publishing the frozen prepared capability. Its closure exposes only digest, byte count and processing; no caller receives a snapshot or writable alias. Every worker receives a view of the same private backing store. Internal Sharp processing treats input as read-only. This is encapsulated immutability, not a claim that shared memory is inherently read-only.

Ordinary `process()` and runtime prepared snapshots keep their previous behavior. Runtime cache policy, request admission, queue byte accounting, separate build admission, per-worker JS resource limits and terminating execution deadlines remain intact. Neither worker count nor codec options change. Each snapshot remains bounded by the existing source byte limit; its lifetime follows the already owned prepared source and active work. No new retained source map, persistent worker source cache, transfer detachment, global native setting or unbounded allocation is introduced.

Both worker and host continue all existing signature, pixel/frame, input/output and format checks. Source metadata is not trusted merely because it was checked on the host. Encoded outputs remain exclusively owned or safely copied under the existing transfer conditions. Returned image buffers cannot mutate the source or another cached result. Existing pipeline fingerprinting automatically invalidates prior representation-cache entries after the processing source change; cache invalidation is a one-time cost.

## Why no new Rust surface

This optimization removes structured-clone copies at the Node worker boundary. A Rust/WASM wrapper would still need host copies and worker serialization; rewriting a codec or hashing implementation is not supported by the profile. Sharp/libvips continues native C++ decode/resize/encode, and the existing bounded Rust module continues previews. No Rust performance claim, new compiler step or browser WASM is introduced. Contributor native verification remains unchanged.

## Acceptance

Require complete byte-identity across baseline/candidate/tools, medians and RSS together, owned offset-source tests, concurrent real workers, input/output mutation isolation, decode failure recovery, all existing resource/security tests, full native/packaging/browser/CI gates. Retain exploratory measurements including any regressions. Publish the bounded measured benefit without claiming whole-market leadership or the still unmet component size goal. Detailed results belong in the dated benchmark report and REPORT.md.

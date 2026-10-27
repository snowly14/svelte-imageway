# One owned native executor for finite Vite builds

## Context and decision

The before-change seven-round study measures photographic WebP builds at one,
two and four workers. Four gives the lowest cold latency and the highest RSS.
Tracing shows repeated worker/Sharp module startup; promise durations do not
separate libvips decode, resize and encode CPU. Sharp already dispatches its
asynchronous work to native threads. A Rust/FFI orchestration wrapper would add a
boundary without replacing that work, so this change uses Node's worker transport.
The separately measured Rust preview kernels remain in use.

Use one physical Node worker for the Vite **build** executor, with up to the
configured number of concurrent Sharp transforms. The default remains up to four
logical transforms, capped by available parallelism. Explicit concurrency is still
an integer from one to 32. Each command has a bounded unique ID and a deadline.
Keep the same transform function, decoder limits, codecs, quality, private shared
source snapshots, output transfers and cache ownership.

This executor is private to `imageway()` finite builds. Development serving,
direct `ImageProcessor` calls (including `build: true`) and the self-hosted runtime
retain the existing pool, runtime admission and per-worker task isolation. No
export, flag or consumer toolchain is added. The processor's protected transport
seam allows the internal specialization without changing its public constructor.

## Failure and resource bounds

At most N commands are active in the worker; finite build waiters remain outside
runtime admission. The worker retains the 64 MiB V8 old-generation limit. This
limit does **not** cap native libvips process RSS. Existing input, dimensions,
decoded-pixel, encoded-output and execution limits still apply to each transform.

Ordinary task errors preserve their ImagewayError code/status and leave the worker
usable. A crash, malformed transport, failed dispatch or hard timeout terminates
the physical worker. Native permits are released and replacement work starts only
after termination completes. A rejected termination quarantines the worker until
its actual exit confirms it stopped; no new native work is admitted meanwhile.
Startup waits are bounded, and an expired waiter cannot later create an orphan
replacement. Idle workers are unreferenced and retired after five seconds.

A fatal event affects the other transforms sharing this **Vite build** worker.
The timed-out task reports TIMEOUT/504; co-located tasks report WORKER/500. Vite
already fails if any required variant fails. This shared failure scope is an
explicit internal build tradeoff; it must not spread to runtime requests. No
automatic fallback starts overlapping native work after an unconfirmed stop.

Transport tests cover out-of-order replies, bounded admission, source/output
ownership, task errors, crashes, malformed replies, dispatch/construction failures,
idle reuse, failed termination, deadlines and recovery. A real stuck Worker is
terminated before a replacement produces byte-identical Sharp output. Full packed
consumer and image-build tests exercise the shipped worker file.

## Evidence and rejected alternatives

See [the dated study](../../bench/SPARSE-COLOUR-3.1.8.md) for cold/warm medians,
RSS, all original rows and competitor comparisons. The success-only virtual-worker
prototype stays in `bench/multiplex`, outside the package; it lacks production
deadline/failure handling and must never become a fallback.

The selected executor lowers cold WebP build RSS. It does not establish market
leadership or an end-to-end codec speedup. Default multi-format imports are a
separate study; their encoder memory and timing costs must remain visible. No
additional native build command is needed. Rust contributors continue to use the
fixed-memory preview rebuild/fingerprint checks documented in CONTRIBUTING.md.

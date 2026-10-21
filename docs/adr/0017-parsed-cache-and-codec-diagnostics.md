# 0017 — Parsed private representation cache and codec diagnostics

Date: 2026-10-21

Status: Accepted subject to the recorded validation and measurements.

## Context

Every encoded memory-cache hit previously cloned the packed artifact, parsed its metadata, copied the payload and repacked cache ownership. The processing policy and codec inventory were also serialized into every representation key. These operations repeat even though the processor owns its policy and cached artifacts.

JPEG XL is supported by some current browsers, but the installed Sharp binaries report neither JXL buffer input nor output. Recognizing a magic signature is insufficient evidence that a decoder exists.

## Decision

Use a private parsed representation cache bounded by the same logical packed-byte budget, entry count and renewed one-hour lifetime. Its owned payload never escapes: callers receive a defensive copy on every hit. Disk serialization stays compatible in structure and retains validation and fallback behavior. Oversized entries are not copied into memory. The processor takes a frozen validated policy snapshot and hashes its pipeline/codec/policy identity once. Pipeline revision changes invalidate older disk keys as usual.

Preserve raw and prepared input behavior; reject oversized raw inputs before hashing/admission. Do not change native encoder settings, request authentication, source expiry, queue admission or transform deadlines.

Expose typed CodecCapabilities and the codecs CLI command from actual Sharp metadata. JXL signature recognition now checks installed decoder capability before native decode, including Vite metadata loading. No automatic JXL output, bundled encoder or successful custom-libvips validation is claimed. Existing typed artifacts may carry already encoded JXL sources with fallbacks.

## Evidence and limits

Tests cover output mutation after disk/memory hits, a too-small memory budget, persistent reuse, codec inventory/CLI and absent JXL decoder diagnostics. Paired processor benchmarks exclude the first native transform and warm-up: they measure prepared memory-cache lookups, not encoders, HTTP or a CDN. A separate alternating HTTP comparison measures the complete local service. All outputs are checked against the baseline and host contention remains uncontrolled.

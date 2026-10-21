# ADR 0015: Measured delivery costs and a lightweight static component

The user requested further improvements across performance, bugs and benchmark quality. Preserve 1.2.0 as immutable; the additive API and behavior are versioned 1.3.0.

## Output buffers

Signature detection reads the exact input view without a whole-buffer copy. Worker outputs transfer ownership only for exact-sized ArrayBuffers that are not marked untransferable. Partial, pooled and shared backing allocations retain the clone path. The parent wraps an exact-sized returned buffer without another copy; partial views retain a defensive copy. Inputs, worker admission, queue byte limits, deadlines and encoder settings are unchanged.

A prepared/shared input snapshot API was evaluated in seven alternating pairs. It did not demonstrate a reliable build-time improvement on the small fixture, so it was removed rather than expanding the public API around unproven gains.

## Format selection

An Accept-capable browser may prefer AVIF even when the generated AVIF is larger. At production build time, omit the default AVIF format only if all corresponding WebP width/height outputs are no larger. Do not remove fallback formats or explicit format directives. Allow an opt-out. Development remains lazy. This trades no encoding work for fewer emitted bytes: both candidates are encoded before selection. Quality scores across codecs are not equivalent perceptual-quality measurements.

## Component contract

Keep the complete Image behavior and its 3400-byte regression gate. Add StaticImage and a dedicated static entry for typed ImageArtifact inputs. It has no provider configuration, URL construction, custom snippets or transition animations. It preserves native events, responsive sources, dimensions, preview display/removal, lazy loading and matching priority preloads. Measure its entry separately and enforce 1536 gzip bytes. Do not describe the smaller entry as reducing the complete Image entry.

## Benchmarks

Store every sample. Compare before/after in alternating order, with fresh Node processes and exact encoded-output equality. Report the runtime and fixture limits, not a market-wide ranking. The optional Worker runtime measurement must require an explicit configured endpoint, so the local Node/IPX benchmark works without hidden infrastructure. Keep old reports dated and distinguish skipped infrastructure.

## Resource policy consistency

Preview decoding previously hardcoded a 40-megapixel limit even when the caller configured a smaller budget. Pass the configured byte/pixel/decode-time limits to preview generation. Apply the output byte limit to optimized SVG output too; that path does not use the raster processor. Regression tests exercise both bypasses.

Fixed-height inside resizing can collapse distinct requested widths into the same encoded width. Deduplicate the resulting format/width candidates before emission; srcset cannot contain repeated width descriptors. Sort ties by requested width to keep output deterministic.

Windows CI exposed source/root path spellings diverging between successive Vite builds. Resolve both physical paths before computing the local key; readLocal still rejects escaping paths and applies its canonical-root containment checks. This handles short-name/junction aliases without loosening the source-key policy.

## Finite build admission (1.3.1)

The real lunar-web build exposed a backlog timeout while encoding the default 21 variants. The request pool started each deadline before queue admission; a later variant could spend most of its time budget waiting for earlier encodings. The 1.3.1 patch adds finite trusted-build scheduling on the shared TransformPool. At most its configured concurrency enters request admission at once; each admitted transform still uses the original worker deadline, memory limits and timeout termination. Runtime HTTP request admission is unchanged. Build waiters are finite compiler work and are not exposed through a request option. A real 70-job batch succeeds with the runtime queue disabled, while a simultaneous runtime request remains rejected at capacity; failures release build slots.

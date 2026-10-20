# ISSUE-0002: build parity with vite-imagetools remains unmet

Status: open; original 1.0 acceptance blocker.

The final reproducible 18-variant benchmark reports median cold 314.9 ms / warm 52.5 ms for Imageway, compared with 145.7 / 39.0 ms for vite-imagetools. Worker reuse and avoiding unused previews reduce overhead, but do not satisfy parity. See bench/README.md and raw results. Equal q75 is not matched visual quality because encoder defaults differ.

Profile worker serialization, process startup, cache metadata and duplicate source reads on a larger licensed photo corpus. Preserve bounded native admission and security checks; do not remove resource limits merely to improve the benchmark. Acceptance requires a new controlled run, not extrapolation from the exploratory pre-reuse measurement.

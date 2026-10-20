# Reproducible package benchmarks

Measurements: 20 October 2026; Apple M4, 10 logical CPUs, 16 GiB RAM, macOS 27 arm64. The orchestrator uses Bun 1.4.3 (its Node compatibility version is not the child runtime). Every build/runtime child used Node 24.22.0 and Sharp 0.35.5; codec versions and all samples are in the JSON files.

## Run

From the repository root, with Node 24 on PATH:

```sh
bun run build
bun run bench:build
bun run bench:runtime
```

`bench:build` regenerates original deterministic synthetic fixtures and runs three cold/warm pairs per tool, in fresh Node processes. Cold deletes the relevant disk cache. Vite runs without app/framework overhead: 3 opaque 1200×800 sources × widths 320/640/960 × WebP/JPEG quality 75 = 18 output images. Placeholder work is disabled where configurable. Version pins are in bun.lock. Sharp defaults differ: Imageway uses mozjpeg; output bytes and quality numbers are not a perceptual quality match.

| Median          | Imageway | vite-imagetools | enhanced-img |
| --------------- | -------: | --------------: | -----------: |
| Cold build      | 314.9 ms |        145.7 ms |     149.6 ms |
| Warm disk build |  52.5 ms |         39.0 ms |      38.9 ms |
| Output bytes    |  498,652 |         745,147 |      745,147 |

[build.json](results/build.json) is the authoritative final run. The earlier exploratory `build-before-pool-reuse.json` was collected before worker reuse, while other work ran; do not use it to claim a controlled speedup. Build parity with imagetools is **not met**. See ISSUE-0002.

## Weight

The source fixtures are generated in run.ts, not downloaded photos. Source/output measurements at width 960, WebP/AVIF q75 give 92.0% median reduction over six outputs. This includes resizing. Texture AVIF reduces only 52.1%; results must not be generalized to every photo or every encoder setting. There is no perceptual quality score in this experiment.

## Runtime

`bench:runtime` uses the generated fixtures and starts three fresh local Node HTTP processes per engine. Same source, width 640, WebP q75: one cold request, 30 repeats, then 100 requests at concurrency four. Imageway's built-in memory/disk cache is compared with a bare IPX handler without an added CDN cache. Therefore the warm difference measures the complete configured service, not an encoding-speed advantage.

| Median across three processes | Imageway |             IPX |
| ----------------------------- | -------: | --------------: |
| Cold TTFB                     |  90.1 ms |         47.9 ms |
| Warm median TTFB              |   0.9 ms |         23.7 ms |
| Burst requests/s              |    1,461 |             129 |
| Peak RSS                      |  198 MiB |         189 MiB |
| Repeat cache hits             |     100% | No cache header |

[runtime.json](results/runtime.json) includes individual samples, bytes, metrics and RSS. Worker [worker-local.json](results/worker-local.json) measures the local Images binding: it is not a geographically distributed/native production Cloudflare benchmark, and is not an apples-to-apples production comparison. No paid Cloudflare timing is claimed.

## Browser performance

`bun scripts/lighthouse.ts` measures the already-built component verification fixture on port 4173 with Lighthouse 13.5.0 / Playwright Chromium, mobile 390×844 emulation. It scored **99/100**, CLS **0**, LCP **1.61 s**, TBT **84 ms** in this run. LCP discovery and unsized-image checks pass. The page includes deliberate broken-image, callback and lazy-loading tests. This single run does not meet or establish the exact 100/100 target. Raw metrics: [lighthouse.json](results/lighthouse.json).

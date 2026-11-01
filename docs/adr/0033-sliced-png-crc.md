# ADR 33: Slicing-by-four CRC inside the bounded Rust PNG kernel

Status: accepted in 3.1.10. Date: 1 November 2026.

The existing server/build Rust kernel creates small uncompressed PNG previews. Its scalar CRC recurrence processes one byte at a time. Four precomputed tables allow four bytes per iteration with the same CRC polynomial and final bytes. This changes no export or public API. The extra three tables consume 3072 fixed data bytes; the module grows from 14838 to 17983 bytes. Initial and maximum memory remain 65536 bytes, with no imports and no consumer Rust toolchain. Browser code still does not load WASM.

Seven alternating local pairs at 32×32 measure the previous Rust kernel at 9.982 µs, candidate at 4.551 µs and an optimized slicing-by-four JavaScript control at 8.461 µs. Host dimension/length validation, input copy and owned binary output are included for Rust; JS reads its input directly and returns owned output. The control setup timing includes retrieving the old artifact through git and must not be used to compare compilation/startup. All samples, the earlier pilot without equivalent host checks, and the JS control are retained. This is a PNG-kernel CPU gain with a larger module, not an image-codec speedup.

Complete ThumbHash previews on 24 pinned photos in seven alternating fresh-process pairs are 4.95593→4.96143 ms/preview, with process RSS 131.0625→130.9531 MiB. The slight timing regression is retained; the full-preview range does not establish an improvement. Every complete-preview digest matches. The change is selected for the measured bounded CPU gain; it does not resolve cold builds, component size or overall preview latency.

Every read in the four-byte loop is guarded by the chunk end, itself bounded by validated dimensions (at most 32×32). The scalar tail handles the remainder. Independent reference tests cover every width/height pair in 1..32 with zero, white and seeded random pixels, byte-for-byte with ThumbHash's PNG implementation. Invalid dimensions leave output untouched. Growth rejection and independent artifact rebuild remain mandatory.

Missing-artifact behavior is unchanged: preview strategies requiring the kernel fail on artifact read/ABI validation; there is no silent fallback to a different representation. `none` does not need the kernel. Contributors use the existing pinned Rust 1.99.0, `bun run native:rebuild`, and `bun run native:verify`; CI already verifies fingerprints and performs the independent full rebuild. No new native build command is introduced.

A separate seven-pair JS-control ablation assembles words with shifts instead of Buffer.readUInt32LE. At 32×32, old Rust/new Rust/manual JS medians are 9.925/4.486/8.436 µs; outputs match across all 2048 dimension/input cases. Run `node bench/native-png-crc.mjs --manual-js --output=.local/png-manual-repeat.json` to repeat without overwriting tracked samples. This period remains separate from the first study.

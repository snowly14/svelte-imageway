#![no_std]
// Fixed-size scratch storage. One synchronous encoder owns each WASM instance.
static mut PIXELS: [u8; 4096] = [0; 4096];
static mut TABLES: [f64; 928] = [0.0; 928];
static mut OUTPUT: [f64; 36] = [0.0; 36];
// At most 1024 pixels: u16 bins cannot overflow. Storage remains inside one WASM page.
static mut HISTOGRAM: [u16; 4096] = [0; 4096];
// ThumbHash uses one channel at a time, not four unbounded image planes.
static mut CHANNEL: [f64; 1024] = [0.0; 1024];
static mut THUMB: [u8; 32] = [0; 32];
#[no_mangle]
pub extern "C" fn thumbhash_ptr() -> *mut u8 {
    &raw mut THUMB as *mut u8
}

// Bounded ThumbHash LPQA/DCT encoder, compatible with Evan Wallace's MIT reference.
// Cosines are initialized by the host with the reference JS arithmetic order.
#[no_mangle]
pub extern "C" fn thumbhash(width: u32, height: u32) -> u32 {
    if width == 0 || height == 0 || width > 32 || height > 32 {
        return 0;
    }
    let w = width as usize;
    let h = height as usize;
    let count = w * h;
    // SAFETY: both host and native validate dimensions. Channels <=1024, DCT <=28
    // coefficients, output <=25 bytes. The host serializes access to the instance.
    unsafe {
        let mut average = [0.0; 4];
        for i in 0..count {
            let offset = i * 4;
            let alpha = PIXELS[offset + 3] as f64 / 255.0;
            for channel in 0..3 {
                average[channel] += alpha / 255.0 * PIXELS[offset + channel] as f64;
            }
            average[3] += alpha;
        }
        if average[3] != 0.0 {
            for channel in 0..3 {
                average[channel] /= average[3];
            }
        }
        let alpha = average[3] < count as f64;
        let limit = if alpha { 5.0 } else { 7.0 };
        let longest = w.max(h) as f64;
        let lx = ((limit * w as f64 / longest + 0.5) as usize).max(1);
        let ly = ((limit * h as f64 / longest + 0.5) as usize).max(1);
        let start = if alpha { 6 } else { 5 };
        let mut ac_index = 0;
        let mut dc = [0.0; 4];
        let mut scales = [0.0_f64; 4];
        for i in 0..32 {
            THUMB[i] = 0;
        }
        for channel in 0..if alpha { 4 } else { 3 } {
            for i in 0..count {
                let offset = i * 4;
                let a = PIXELS[offset + 3] as f64 / 255.0;
                let r = average[0] * (1.0 - a) + a / 255.0 * PIXELS[offset] as f64;
                let g = average[1] * (1.0 - a) + a / 255.0 * PIXELS[offset + 1] as f64;
                let b = average[2] * (1.0 - a) + a / 255.0 * PIXELS[offset + 2] as f64;
                CHANNEL[i] = match channel {
                    0 => (r + g + b) / 3.0,
                    1 => (r + g) / 2.0 - b,
                    2 => r - g,
                    _ => a,
                };
            }
            let (nx, ny) = match channel {
                0 => (lx.max(3), ly.max(3)),
                3 => (5, 5),
                _ => (3, 3),
            };
            let mut ac = [0.0; 28];
            let mut used = 0;
            for cy in 0..ny {
                let mut cx = 0;
                while cx * ny < nx * (ny - cy) {
                    let mut value = 0.0;
                    for y in 0..h {
                        let fy = TABLES[704 + cy * 32 + y];
                        for x in 0..w {
                            value += CHANNEL[x + y * w] * TABLES[480 + cx * 32 + x] * fy;
                        }
                    }
                    value /= count as f64;
                    if cx == 0 && cy == 0 {
                        dc[channel] = value;
                    } else {
                        ac[used] = value;
                        used += 1;
                        scales[channel] = scales[channel].max(value.abs());
                    }
                    cx += 1;
                }
            }
            for i in 0..used {
                let value = if scales[channel] != 0.0 {
                    0.5 + 0.5 / scales[channel] * ac[i]
                } else {
                    ac[i]
                };
                THUMB[start + (ac_index >> 1)] |=
                    ((15.0 * value + 0.5) as u8) << ((ac_index & 1) * 4);
                ac_index += 1;
            }
        }
        let landscape = w > h;
        let header24 = (63.0 * dc[0] + 0.5) as u32
            | (((31.5 + 31.5 * dc[1]) + 0.5) as u32) << 6
            | (((31.5 + 31.5 * dc[2]) + 0.5) as u32) << 12
            | ((31.0 * scales[0] + 0.5) as u32) << 18
            | (alpha as u32) << 23;
        let header16 = if landscape { ly as u32 } else { lx as u32 }
            | ((63.0 * scales[1] + 0.5) as u32) << 3
            | ((63.0 * scales[2] + 0.5) as u32) << 9
            | (landscape as u32) << 15;
        THUMB[0] = header24 as u8;
        THUMB[1] = (header24 >> 8) as u8;
        THUMB[2] = (header24 >> 16) as u8;
        THUMB[3] = header16 as u8;
        THUMB[4] = (header16 >> 8) as u8;
        if alpha {
            THUMB[5] = (15.0 * dc[3] + 0.5) as u8 | ((15.0 * scales[3] + 0.5) as u8) << 4;
        }
        (start + (ac_index + 1) / 2) as u32
    }
}
// Reference-compatible uncompressed PNG; fixed storage for at most 32x32 RGBA.
static mut PNG: [u8; 4400] = [0; 4400];
#[no_mangle]
pub extern "C" fn png_ptr() -> *mut u8 {
    &raw mut PNG as *mut u8
}
const fn crc_table() -> [u32; 256] {
    let mut table = [0; 256];
    let mut index = 0;
    while index < 256 {
        let mut c = index as u32;
        let mut bit = 0;
        while bit < 8 {
            c = if c & 1 != 0 {
                (c >> 1) ^ 0xedb88320
            } else {
                c >> 1
            };
            bit += 1;
        }
        table[index] = c;
        index += 1;
    }
    table
}
static CRC: [u32; 256] = crc_table();
unsafe fn png_u32(offset: usize, value: u32) {
    for i in 0..4 {
        PNG[offset + i] = (value >> (24 - i * 8)) as u8;
    }
}
#[no_mangle]
pub extern "C" fn rgba_png(width: u32, height: u32) -> u32 {
    if width == 0 || height == 0 || width > 32 || height > 32 {
        return 0;
    }
    // SAFETY: a 32x32 image requires at most 4351 bytes, within PNG's 4400.
    // All offsets derive from checked dimensions; each caller owns the instance.
    unsafe {
        let row = width as usize * 4 + 1;
        let idat = 6 + height as usize * (5 + row);
        let prefix = [
            137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 0, 0, 0, 0, 0,
            8, 6, 0, 0, 0, 0, 0, 0, 0,
        ];
        for i in 0..prefix.len() {
            PNG[i] = prefix[i];
        }
        png_u32(16, width);
        png_u32(20, height);
        png_u32(33, idat as u32);
        for (i, value) in [73, 68, 65, 84, 120, 1].iter().enumerate() {
            PNG[37 + i] = *value;
        }
        let mut offset = 43;
        let mut a = 1_u32;
        let mut b = 0_u32;
        for y in 0..height as usize {
            PNG[offset] = if y + 1 < height as usize { 0 } else { 1 };
            PNG[offset + 1] = row as u8;
            PNG[offset + 2] = (row >> 8) as u8;
            PNG[offset + 3] = !(row as u8);
            PNG[offset + 4] = !((row >> 8) as u8);
            PNG[offset + 5] = 0;
            offset += 6;
            b += a;
            for x in 0..width as usize * 4 {
                let value = PIXELS[y * width as usize * 4 + x];
                PNG[offset] = value;
                offset += 1;
                a = (a + value as u32) % 65521;
                b += a;
            }
            // At most 129 bytes per row: a < 98300 and b < 13 million.
            // Reducing once per row preserves Adler-32 without per-byte division.
            a %= 65521;
            b %= 65521;
        }
        png_u32(offset, (b << 16) | a);
        offset += 4;
        for (i, value) in [0, 0, 0, 0, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]
            .iter()
            .enumerate()
        {
            PNG[offset + i] = *value;
        }
        let length = offset + 16;
        for (start, end) in [(12, 29), (37, 41 + idat)] {
            let mut c = !0_u32;
            for i in start..end {
                c = (c >> 8) ^ CRC[((c ^ PNG[i] as u32) & 255) as usize];
            }
            png_u32(end, !c);
        }
        length as u32
    }
}
static mut DECODE_TABLES: [f64; 448] = [0.0; 448];
#[no_mangle]
pub extern "C" fn decode_tables_ptr() -> *mut f64 {
    &raw mut DECODE_TABLES as *mut f64
}
// Decode a complete ThumbHash into the shared RGBA plane (at most 32x32).
// The host initializes reference-order cosine tables for the encoded aspect ratio.
#[no_mangle]
pub extern "C" fn thumbhash_decode(width: u32, height: u32, length: u32) -> u32 {
    if width == 0 || height == 0 || width > 32 || height > 32 || length < 5 || length > 25 {
        return 0;
    }
    // SAFETY: dimensions bound output; header-derived channel sizes are <=7,
    // coefficient count is checked against the supplied hash before any AC read.
    unsafe {
        let header = THUMB[0] as u32 | (THUMB[1] as u32) << 8 | (THUMB[2] as u32) << 16;
        let second = THUMB[3] as u32 | (THUMB[4] as u32) << 8;
        let alpha = header >> 23 != 0;
        let landscape = second >> 15 != 0;
        let short = (second & 7) as usize;
        if short == 0 {
            return 0;
        }
        let long = if alpha { 5 } else { 7 };
        let (lx, ly) = if landscape {
            (long, short)
        } else {
            (short, long)
        };
        let (lx, ly) = (lx.max(3), ly.max(3));
        let start = if alpha { 6 } else { 5 };
        let dc = [
            (header & 63) as f64 / 63.0,
            ((header >> 6) & 63) as f64 / 31.5 - 1.0,
            ((header >> 12) & 63) as f64 / 31.5 - 1.0,
            if alpha {
                (THUMB[5] & 15) as f64 / 15.0
            } else {
                1.0
            },
        ];
        let scales = [
            ((header >> 18) & 31) as f64 / 31.0,
            ((second >> 3) & 63) as f64 / 63.0 * 1.25,
            ((second >> 9) & 63) as f64 / 63.0 * 1.25,
            (THUMB[5] >> 4) as f64 / 15.0,
        ];
        let shapes = [(lx, ly), (3, 3), (3, 3), (5, 5)];
        let mut coefficients = [[0.0; 28]; 4];
        let mut index = 0;
        for channel in 0..if alpha { 4 } else { 3 } {
            let (nx, ny) = shapes[channel];
            let mut used = 0;
            for cy in 0..ny {
                let mut cx = if cy == 0 { 1 } else { 0 };
                while cx * ny < nx * (ny - cy) {
                    let offset = start + (index >> 1);
                    if offset >= length as usize {
                        return 0;
                    }
                    let value = (THUMB[offset] >> ((index & 1) * 4)) & 15;
                    coefficients[channel][used] = (value as f64 / 7.5 - 1.0) * scales[channel];
                    used += 1;
                    index += 1;
                    cx += 1;
                }
            }
        }
        if start + (index + 1) / 2 != length as usize {
            return 0;
        }
        for y in 0..height as usize {
            for x in 0..width as usize {
                let mut values = dc;
                for channel in [0, 3] {
                    if channel == 3 && !alpha {
                        continue;
                    }
                    let (nx, ny) = shapes[channel];
                    let mut index = 0;
                    for cy in 0..ny {
                        let fy = DECODE_TABLES[224 + cy * 32 + y] * 2.0;
                        let mut cx = if cy == 0 { 1 } else { 0 };
                        while cx * ny < nx * (ny - cy) {
                            values[channel] +=
                                coefficients[channel][index] * DECODE_TABLES[cx * 32 + x] * fy;
                            index += 1;
                            cx += 1;
                        }
                    }
                }
                // P and Q share their 3x3 triangular basis. Keep each sum's
                // reference order while loading/multiplying that basis once.
                let mut index = 0;
                for cy in 0..3 {
                    let fy = DECODE_TABLES[224 + cy * 32 + y] * 2.0;
                    let mut cx = if cy == 0 { 1 } else { 0 };
                    while cx < 3 - cy {
                        let basis = DECODE_TABLES[cx * 32 + x] * fy;
                        values[1] += coefficients[1][index] * basis;
                        values[2] += coefficients[2][index] * basis;
                        index += 1;
                        cx += 1;
                    }
                }
                let b = values[0] - 2.0 / 3.0 * values[1];
                let r = (3.0 * values[0] - b + values[2]) / 2.0;
                let g = r - values[2];
                for (channel, value) in [r, g, b, values[3]].iter().enumerate() {
                    PIXELS[(y * width as usize + x) * 4 + channel] =
                        (255.0 * value.min(1.0)).max(0.0) as u8;
                }
            }
        }
    }
    1
}
#[no_mangle]
pub extern "C" fn pixels_ptr() -> *mut u8 {
    &raw mut PIXELS as *mut u8
}
#[no_mangle]
pub extern "C" fn tables_ptr() -> *mut f64 {
    &raw mut TABLES as *mut f64
}
#[no_mangle]
pub extern "C" fn output_ptr() -> *mut f64 {
    &raw mut OUTPUT as *mut f64
}
// Same 16-bin-per-channel sRGB quantization as Sharp/libvips dominant colour.
// Zero signals an ambiguous maximum: the host retains libvips tie-breaking.
#[no_mangle]
pub extern "C" fn dominant_colour(width: u32, height: u32) -> u32 {
    if width == 0 || height == 0 || width > 32 || height > 32 {
        return 0;
    }
    // SAFETY: validated dimensions bound RGBA reads; quantized channels bound bins.
    // Each synchronous call owns this instance and resets its fixed histogram.
    unsafe {
        for bin in 0..4096 {
            HISTOGRAM[bin] = 0;
        }
        for pixel in 0..(width * height) as usize {
            let offset = pixel * 4;
            let r = PIXELS[offset] as usize * 16 / 257;
            let g = PIXELS[offset + 1] as usize * 16 / 257;
            let b = PIXELS[offset + 2] as usize * 16 / 257;
            HISTOGRAM[(r << 8) | (g << 4) | b] += 1;
        }
        let mut maximum = 0;
        let mut winner = 0;
        let mut tied = false;
        for bin in 0..4096 {
            let count = HISTOGRAM[bin];
            if count > maximum {
                maximum = count;
                winner = bin;
                tied = false;
            } else if count == maximum {
                tied = true;
            }
        }
        if tied {
            return 0;
        }
        let r = ((winner >> 8) * 16 + 8) as u32;
        let g = (((winner >> 4) & 15) * 16 + 8) as u32;
        let b = ((winner & 15) * 16 + 8) as u32;
        (r << 16) | (g << 8) | b
    }
}
#[no_mangle]
pub extern "C" fn coefficients(width: u32, height: u32) -> u32 {
    if width == 0 || height == 0 || width > 32 || height > 32 {
        return 0;
    }
    let w = width as usize;
    let h = height as usize;
    // SAFETY: validated dimensions bound every access; the synchronous host
    // serializes access and provides initialized RGBA and lookup tables.
    unsafe {
        for j in 0..3 {
            for i in 0..4 {
                let norm = if i == 0 && j == 0 { 1.0 } else { 2.0 };
                let mut r = 0.0;
                let mut g = 0.0;
                let mut b = 0.0;
                for x in 0..w {
                    for y in 0..h {
                        let basis = norm * TABLES[256 + i * 32 + x] * TABLES[384 + j * 32 + y];
                        let p = (y * w + x) * 4;
                        r += basis * TABLES[PIXELS[p] as usize];
                        g += basis * TABLES[PIXELS[p + 1] as usize];
                        b += basis * TABLES[PIXELS[p + 2] as usize];
                    }
                }
                let scale = 1.0 / ((w * h) as f64);
                let out = (j * 4 + i) * 3;
                OUTPUT[out] = r * scale;
                OUTPUT[out + 1] = g * scale;
                OUTPUT[out + 2] = b * scale;
            }
        }
    }
    1
}
#[panic_handler]
fn panic(_: &core::panic::PanicInfo) -> ! {
    core::arch::wasm32::unreachable()
}

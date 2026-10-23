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

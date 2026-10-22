#![no_std]
// Fixed-size scratch storage. One synchronous encoder owns each WASM instance.
static mut PIXELS: [u8; 4096] = [0; 4096];
static mut TABLES: [f64; 480] = [0.0; 480];
static mut OUTPUT: [f64; 36] = [0.0; 36];
// At most 1024 pixels: u16 bins cannot overflow. Storage remains inside one WASM page.
static mut HISTOGRAM: [u16; 4096] = [0; 4096];
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

# Component-owned metadata and shared image styles

## Decision

Destructure Svelte-only props through Svelte 5 `$props()` in Image/Picture. Keep Image's PICTURE_REQUIRED check and loading-string/snippet disambiguation; native callbacks/data/class/style attributes remain forwarded. Remove component-only keys from the shared headless destructure, where valid ImageOptions do not contain snippets. This avoids charging every headless call for component filtering. No public type, prop or exported helper is removed or added.

Construct style strings directly in the same order, with identical semicolons/validation/custom-style precedence, avoiding temporary filter/map arrays. Read dominantColor once and validate that exact value before using it. Expand size tokens by prepending segments in the existing reverse-priority order; a null-prototype lookup prevents inherited names such as constructor from becoming breakpoints. Unknown tokens remain literal.

Reuse the fallback URL when generating its matching srcset candidate. A provider still receives a new request object for every distinct URL; exact URLs, codecs, widths, quality, validation and ordering remain unchanged. This also keeps nonce-bearing fallback/candidate URLs consistent. Provider URL builders should return a URL for the request, not depend on being called redundantly.

Share one auto-imported, namespaced image.css between Image/Picture. The internal imageway-image class gates every selector; ready/fade behavior, reduced motion and native class forwarding remain. Keyframes use the library namespace. This removes duplicate CSS on combined pages. Mark only CSS as package side effects; a real root-import headless-only fixture must emit no stylesheet. These marker names are internal, not a new styling API.

Svelte-generated declaration files retain the runtime CSS import. Strip only the known ../image.css side-effect line from component declarations during package finalization, then copy the clean declaration to both supported Svelte declaration filenames. CSS remains in runtime component sources/dist; NodeNext/bundler type checks need no consumer declaration or compiler-option changes. Do not disable ATTW internal-resolution diagnostics.

## Evidence and tradeoffs

Seven paired/three-way headless measurements, actual 24-image SSR fixtures and Image/Picture/Both SSR/hydration/no-JS client builds live in bench/COMPONENT-PROPS-3.1.8.md. Preserve the original scoped-CSS period, every rejected helper/tuple/Object.assign diagnostic, native attrs/ownership/snippet/source tests and all JS+CSS costs. The shared CSS is a whole-page win in combined pages, not an isolated JS-size win. The 2000-byte goal remains unmet; no hidden chunks or browser WASM are introduced.

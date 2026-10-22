# Ordinary imports and explicit component markup

The user wants ordinary image imports, no generated declarations, and predictable Image versus Picture markup. This is a stable-major change.

The Vite plugin prepares ordinary application raster imports by default. Their exported value remains the original URL string, matching Vite's public types and native img semantics. Generated module code registers a serializable optimized artifact under that URL. A Symbol.for registry shares identity across bundled/external SSR module copies. Stable hashed module identities replace registrations on HMR; equal original URLs remain registered while another module identity still uses them. Registration is driven only by module evaluation, never by HTTP input. Production registration count follows the module graph; it adds resident metadata and preserves an emitted original alongside variants.

Image and StaticImage resolve the artifact's explicit img representation and always emit img. Picture and StaticPicture retain explicit format sources and always emit picture. No browser feature detection or hydration-dependent format choice is used. The img representation prefers WebP when generated, otherwise the configured fallback; Picture is the explicit choice for AVIF/WebP format selection.

SVG icons, dependency assets and explicit raw/url imports retain Vite behavior. autoImports:false supports projects that prefer only explicit artifact generation. Dynamic URLs keep provider-based optimization and cannot be inferred as build imports.

Public declarations reference the bundled narrow ?img and trailing &img declarations. Ordinary imports retain standard Vite string types. We remove project scans, generated env files and the typegen command. Advanced imports put img last; unsupported spellings fail type checking rather than introducing an unsafe catch-all declaration.

Encoding/cache/HTTP speed is not changed by this API revision. Recheck bundle budgets, DOM, preload identity, real packed strict SvelteKit consumers, original byte preservation and SSR without JavaScript. Retain historical benchmark labels rather than presenting older timings as a new 2.0 gain.

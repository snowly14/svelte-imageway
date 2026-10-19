# Provider contract verification — 2026-10-20

URL conformance tests are local, deterministic tests, not proof of paid-account activation. A real public Cloudinary demo transform was additionally fetched and decoded (see validation evidence). Capabilities deliberately expose a conservative intersection; unsupported operations throw 422 instead of disappearing. The portable v1 request is translated to each native API, not appended blindly.

| Provider | Implemented contract | Official reference / constraint |
|---|---|---|
| Bunny | inside resize, width/height/quality/format | [Dynamic Images](https://docs.bunny.net/docs/stream-image-processing/); enable Optimizer on the Pull Zone; no AVIF declaration |
| imgix | max/crop/scale/fill, q/fm/auto | [Resize fit](https://docs.imgix.com/en-US/apis/rendering/size/resize-fit-mode); signed URL mutation rejected |
| Cloudinary | upload public IDs or fetch, c_limit/fill/pad/scale, w/h/q/f | [Transformation reference](https://cloudinary.com/documentation/transformation_reference); fetch delivery may need enabling, secure account with strict transformations |
| ImageKit | c-at_max, w/h/q/f | [Resize/crop](https://imagekit.io/docs/image-resize-and-crop); signed URLs must be regenerated on the server |
| imgproxy | rs:fit/fill, q, escaped plain source | [Processing](https://docs.imgproxy.net/usage/processing); unsafe mode requires explicit opt-in and a private protected origin, never an open public optimizer |
| IPX | w/h/q/f modifiers | [Official project](https://github.com/unjs/ipx); configure its storage allowlist independently |
| Supabase | public render endpoint, width/height/quality/resize | [Transformations](https://supabase.com/docs/guides/storage/serving/image-transformations); format is negotiated, signed tokens are generated server-side, plan restrictions apply |
| Fastly | bounds, width/height/quality/format | [IO reference](https://www.fastly.com/documentation/reference/io/); product entitlement required; may fall back at native format limits, therefore no typed explicit-format sources |
| CloudFront | Imageway v1 origin behind distribution | [Query forwarding/cache](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/QueryStringParameters.html); CloudFront itself is not an encoder; this does not impersonate the separate AWS image solution |
| Uploadcare | preview, quality presets, format | [Resize](https://uploadcare.com/docs/transformations/image/resize-crop/), [quality](https://uploadcare.com/docs/compression/); numeric quality is mapped to native named presets |

CMS: [Sanity](https://www.sanity.io/docs/apis-and-sdks/presenting-images), [Contentful](https://www.contentful.com/developers/docs/references/images-api/images/), [Storyblok](https://www.storyblok.com/docs/api/image-service), [Directus](https://docs.directus.io/reference/files), [Shopify](https://shopify.dev/docs/api/liquid/filters/image_url), [Prismic](https://prismic.io/docs/fields/image), [DatoCMS](https://www.datocms.com/docs/content-delivery-api/images-and-videos), [Unsplash](https://unsplash.com/documentation). Unsplash attribution query is retained; consumers must still satisfy API attribution/hotlink obligations. Self-hosted Directus needs an explicit kind/base. Strapi and WordPress have no universal resize query: map their media response variants to `cmsArtifact`. See [Strapi media](https://docs.strapi.io/cms/features/media-library) and [WordPress media](https://developer.wordpress.org/rest-api/reference/media/).

All URL builders are credential-free. No platform purge API is implied by a URL provider. Use the protected Imageway Worker purge API or the platform SDK in a server-only module. Signed third-party transforms require vendor server signing; universal Imageway HMAC is not interchangeable with vendor signatures.

`createFallback` is server transport orchestration, not a browser retry loop. Its required transport must enforce the source policy. It retries network/timeouts/5xx, opens a per-instance circuit, uses a half-open probe and stops on 4xx (including authentication and budget errors). Original fallback is an explicit authorizing callback. Global circuit state requires an operator-supplied shared service; no private image becomes public on failure.

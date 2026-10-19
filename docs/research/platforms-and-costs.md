# Platforms, topology and costs

Reviewed 2026-10-19 from the official sources linked in each row. Prices are USD, before taxes and account-specific contracts. This is a research snapshot, not a price guarantee or a deployment test. Refresh pricing at each provider's implementation gate and before release.

## Topology

Layer A delegates transformations to a configured image provider. Layer B is an image origin/service that should sit behind an actual CDN. Layer C publishes immutable build artifacts to storage with a public delivery base. These may be combined; the npm package includes no global distribution network, storage subscription, or third-party usage allowance.

Recommended flows:

- Managed: browser → provider CDN/optimizer → approved source origin.
- Self-hosted: browser → CDN → Imageway Node/Bun service → approved source origin.
- Worker: browser → Worker/cache → Images binding or transformation service → approved origin/R2.
- Static: browser → CDN/storage → prebuilt content-addressed artifact; no runtime transformation.

The service is not automatically an SSRF-safe network boundary merely because it is at the edge. A restricted object-key source is the preferred Worker mode.

## Main providers

| Platform | Confirmed integration and restrictions | Current cost signals | Execution |
| --- | --- | --- | --- |
| [Cloudflare remote transformations](https://developers.cloudflare.com/images/optimization/transformations/overview/) | `/cdn-cgi/image/` needs transformations enabled on the zone; origin restrictions apply. Worker `fetch` transformations and hosted Images are distinct modes | [Pricing](https://developers.cloudflare.com/images/pricing/): first 5,000 unique transformations/month included; paid excess $0.50/1,000. Free blocks new transformations above allowance. Hosted storage $5/100,000 images/month and delivery $1/100,000 are separate meters | Documentation only |
| [Cloudflare Images binding](https://developers.cloudflare.com/images/optimization/binding/) | Stream input/transform/output; explicit output MIME required. Offline local mode supports fewer transforms than production | Same transformation meter; Worker and storage costs can be additional | Neither local nor remote mode run yet |
| [Vercel](https://vercel.com/docs/image-optimization) | SvelteKit adapter/Build Output API must configure allowed sizes/origins/formats; `/_vercel/image` is platform infrastructure, not a general remote URL API | [Pricing](https://vercel.com/docs/image-optimization/limits-and-pricing): Hobby includes 5K transforms, 300K read units, 100K write units/month. On-demand transforms $0.05–0.0812/1K; reads $0.40–0.64/1M; writes $4–6.40/1M. Cache units are 8KB. Delivery costs extra; Hobby limited to personal non-commercial use | Documentation only |
| [Netlify](https://docs.netlify.com/build/image-cdn/overview/) | `/.netlify/images`; w/h, contain/cover/fill, format negotiation; remote images require explicit `remote_images`. Local-image invalidation follows atomic deploys | [Pricing](https://www.netlify.com/pricing/): Free 300 credits/month; Personal $9/1,000 credits; Pro starts $20/3,000 credits. Delivery meters include 20 credits/GB and 2 credits/10K web requests. Do not promise unlimited free CDN traffic | Documentation only |
| [Bunny Optimizer](https://bunny.net/pricing/optimizer/) | Pull Zone add-on, not an included image origin; parameter/format/signature mapping requires M6 conformance checks | $9.50/website/month. The [official FAQ](https://bunny.net/faq/) specifies per Pull Zone, billed hourly, with CDN bandwidth additional | Documentation only |
| [Cloudinary](https://cloudinary.com/pricing) | Managed assets and delivery transforms; signing and remote-fetch restrictions need explicit backend mapping | Free plan 25 monthly credits. Credits combine resource meters; do not equate one credit with one transform or assume arbitrary remote fetch is enabled | Pricing reviewed; API parity pending M6 |
| [ImageKit](https://imagekit.io/plans/) | URL endpoint/provider integration; transformation limits vary by plan | Free: 20GB bandwidth/month, 3GB DAM storage. $9 plan: 40GB bandwidth, 10GB DAM; overages listed separately | Pricing reviewed; API parity pending M6 |
| [imgix](https://www.imgix.com/pricing) | Managed source/provider; transformed media and delivery share credits | Starts $25/month for 100 credits; 30-day trial. “Up to” storage/bandwidth figures are alternatives consuming a common allowance, not additive quotas | Pricing reviewed; API parity pending M6 |
| [Supabase transformations](https://supabase.com/docs/guides/storage/serving/image-transformations) | Storage bucket images; resize enabled on Pro and above; SDK public/signed URL transforms | Use the [account's current plan](https://supabase.com/pricing) and image/egress meters. Do not claim availability on Free or quote a per-image fee without its billing unit | Documentation only |
| [Fastly Image Optimizer](https://www.fastly.com/products/image-optimizer) | Edge resize, quality, crop, orientation and format conversion; service configuration required | [Pricing](https://www.fastly.com/pricing) is service/plan-specific; a final image workload quote is not established here | Product reviewed; API limits and exact account cost pending M6 |
| [CloudFront transformation solution](https://docs.aws.amazon.com/solutions/dynamic-image-transformation-for-amazon-cloudfront/) | CloudFront distribution plus deployed transformation infrastructure; not a built-in universal `?w=` optimizer | CloudFront, processing, object storage, logs and requests can all contribute; use solution estimate and regional pricing | Architecture reviewed; no stack deployed |
| [Uploadcare](https://uploadcare.com/pricing/) | Optional managed-media provider candidate | Current pricing page was reachable but a stable numerical quote was not exposed in the retrieved content. No numerical/free-tier claim is made | Deferred optional provider until official API and billing evidence are captured |
| [imgproxy](https://docs.imgproxy.net/) / [ipx](https://github.com/unjs/ipx) | Existing self-hosted backends, provider URLs map to their contracts; codecs/features depend on build and edition | Software licensing/edition and compute/storage/CDN expenses are separate | Documentation only |
| local / edge / generic | local uses optional Sharp; edge uses v1; generic is a user-specified safe template | Host compute, disk, network and CDN costs; no package usage fee | Planned, no implementation |

An API or cost marked pending is a research gap and a release gate, not an implemented capability. Especially do not market optional Uploadcare, Fastly parity, or all-provider feature parity on this evidence.

## Cloudflare limits affecting design

The current [Images limits](https://developers.cloudflare.com/images/get-started/limits/) distinguish remote sources (100MB) from hosted uploads (10MB) and binding input (20MB). They also list 100MP image area limits, stricter animation handling, and an AVIF dimension limit of 1,200px. Model these as backend capabilities; do not promise all requested widths will produce AVIF. Local `wrangler dev` success would not establish production feature parity.

[Workers limits](https://developers.cloudflare.com/workers/platform/limits/): 128MB per isolate, Free CPU 10ms/request and 100K requests/day, Paid CPU configurable up to five minutes with a lower default. Therefore a general-purpose AVIF WASM fallback is an experiment, not the default encoding plan. Stream bounded inputs; limit concurrent jobs. Cache API and `waitUntil` semantics must be tested independently. R2 is durable object storage, not a guarantee of globally warmed transformation caches.

## Storage publication targets

| Target | Billing evidence and design consequence |
| --- | --- |
| [R2 Standard](https://developers.cloudflare.com/r2/pricing/) | 10GB-month, 1M Class A and 10M Class B operations/month included; beyond: $0.015/GB-month, $4.50/M A and $0.36/M B. Direct R2 egress free; attached metered services can still charge. Use content hashes to avoid redundant writes |
| [S3 / CloudFront](https://aws.amazon.com/s3/pricing/) | Region, storage class, requests and network affect price. No universal free-production-CDN claim; pricing calculation requires the selected region and account |
| [Bunny Storage](https://bunny.net/pricing/storage/) | Replication/storage tier and CDN delivery are separate. Verify the selected regions before estimating uploads and retained variants |
| [Backblaze B2](https://www.backblaze.com/cloud-storage/pricing) | S3-compatible target candidate; verify egress allowances and partner routes for the selected CDN |
| [Vercel Blob](https://vercel.com/docs/vercel-blob/usage-and-pricing) | Storage, operations and delivery meters; not interchangeable with Vercel Image Optimization billing |
| [Supabase Storage](https://supabase.com/pricing) | Storage/egress and transformations have different requirements; public bucket/CDN configuration must be explicit |
| Generic S3 API | Protocol compatibility does not imply identical ACLs, cache headers, checksum behavior, consistency, or pricing |

A cost estimator should accept source count, permitted widths, crops, formats, bytes, requests, hit rate, refresh rate and retention. A bounded transform space constrains compute but does not prevent delivery, attack traffic or log charges. A distributed budget guard requires shared counters and provider/account limits; per-isolate counters are insufficient.

## Negotiated cache configuration

Explicit format URLs are the default and require the whole canonical image query in the CDN cache key. Never ignore source/width/format parameters.

| CDN | Negotiated mode policy |
| --- | --- |
| [Cloudflare](https://developers.cloudflare.com/cache/advanced-configuration/vary-for-images/) | Native Vary for Images is plan-gated (Pro/Business/Enterprise), configured for variants and extension-bearing paths. It does not automatically apply to an arbitrary `/_img` endpoint. For that endpoint, a Worker can negotiate into a canonical explicit-format internal cache URL |
| Fastly | Prefer explicit format. A normalized format key or a verified Vary configuration is required before enabling `auto`; exact service recipe remains a M5/M10 verification item |
| Bunny | Prefer explicit format or the optimizer's documented negotiation. Do not claim arbitrary origin Vary behavior; exact cache recipe remains a M6/M10 verification item |
| [CloudFront](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/controlling-the-cache-key.html) | Include required query fields in cache policy. For negotiated mode, normalize format at the edge into a bounded key; forwarding Accept to the origin without including the normalized variant in cache identity is unsafe |

Raw `Accept`, DPR, Width and Save-Data must not multiply unbounded variants. The service can retain HTTP `Vary: Accept` for downstream correctness while internally storing by negotiated format. A mutable remote URL does not become immutable simply because the request is signed.

## Evidence and release policy

No credentials were read, paid service activated, remote infrastructure created, or cloud deployment attempted. M4–M7 must capture real provider responses or label mock-only conformance tests. M10 must resolve the pending account-independent API/cache details and refresh numerical prices. Account-specific bills cannot be predicted without workload and subscription data.

# FAQ, troubleshooting and migration

**Does the package include a global CDN?** It provides image artifacts, provider adapters and a deployable origin. A CDN/storage subscription is supplied by the operator.

**Why is my transform rejected?** Check runtime vs build directive names, locked preset values, width/quality ladders, allowed origins, actual codec inventory and provider capability subset. Detailed safe errors are returned; debug logs exclude IP/source secrets.

**Why does a dynamic URL have no srcset?** A URL alone cannot select a CDN or discover intrinsic dimensions safely in the browser. Configure a provider and supply dimensions. Normal local imports work without a provider.

**Why is Sharp missing?** Native optional installation may be unsupported or disabled by your package manager. Install a compatible Sharp build with Bun, check codecCapabilities, or choose a native provider. Do not import server entries into a browser bundle.

**Why does GIF fail locally in the Worker?** The offline Images emulator cannot encode GIF and supports a smaller operation set; it returns 422. WebP/JPEG/PNG/AVIF basics are executed locally. Production advanced features need an account-backed staging test.

**Why did a signed URL stop working?** Expiry/key rotation/preset revision or normalized parameters changed. Sign the materialized canonical v1 request with the intended endpoint and policy revision; never append transforms after signing.

**Why is a CMS URL signature rejected?** Vendor signatures are not Imageway signatures. Use a vendor server signer after native transforms or deliver through an independently authorized Imageway key.

**How do I migrate?** Run `migrate --from enhanced-img` or `--from imagetools` without --write, inspect planned changes/review items, then apply with backups and run init. Imagetools picture object shapes differ; convert consumers to Image src. Remove the old plugin after the new build passes. Restore from .imageway-backup when reviewing a failed migration. The CLI never rewrites unsupported operations blindly.

**How do I upgrade to 2.0?** Follow the [migration guide](migration-2.md). Version numbers describe API compatibility; unresolved performance stretch targets remain visible in REPORT.md.

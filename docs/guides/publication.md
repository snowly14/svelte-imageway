# Publish build variants

Imageway uploads only its own content-addressed `imageway/<sha256>.<format>` assets. A CDN is a separate service supplied by the operator. No global `paths.assets` mutation is needed: the Vite plugin rewrites its own artifact URLs, preserving SvelteKit base paths and unrelated assets.

```ts
import { imageway } from 'svelte-imageway/vite';
import { r2 } from 'svelte-imageway/publish/targets';
const target = await r2({ accountId: process.env.CF_ACCOUNT_ID!, bucket: 'public-images',
  accessKeyEnv: 'R2_ACCESS_KEY_ID', secretKeyEnv: 'R2_SECRET_ACCESS_KEY' });
// In Vite plugins, before sveltekit():
imageway({ publish: { target, publicBase: 'https://images.example.com',
  manifestPath: '.imageway/image-manifest.json', concurrency: 4 } });
```

Install the optional server SDK: `bun add -d @aws-sdk/client-s3` for S3/R2/B2, `@vercel/blob` for Blob or `@supabase/storage-js` for Supabase. Factory imports are server/build-only. Bunny uses its official HTTP Storage API. SDK methods and response fields are checked against the installed published types. No SDK/credential is serialized into virtual browser configuration.

Targets: `s3({bucket,region,endpoint?,accessKeyEnv?,secretKeyEnv?,forcePathStyle?})`, `r2`, `backblaze` (S3-compatible options), `bunnyStorage({zone,endpoint?,accessKeyEnv?})`, `vercelBlob({publicBase,tokenEnv?})`, `supabaseStorage({base,bucket,tokenEnv?})`. A custom target implements `id`, `head`, `put`, optional `delete`. Give credentials write access only to this dedicated asset namespace. Default AWS credential chain supports short-lived CI identities; never expose tokens via Vite `VITE_*` variables.

`dryRun: true` performs no remote reads/writes and keeps ordinary local asset URLs. It still emits a planned manifest; that manifest is not proof of an upload. Normal builds use HEAD to skip an existing object with the same hash metadata and size. Stores without hash metadata trust immutable content-addressed keys and size. Preserve this invariant: other tools must not mutate those keys. Transient network/429/5xx failures retry at most twice; authentication failures stop immediately. Failed builds may have uploaded some immutable objects; re-running resumes. The local manifest is replaced atomically only after all uploads succeed. Keep manifests from older deployments.

`collectGarbage(previous,current,{target})` previews stale keys recorded in the previous manifest. `confirm:true` permits deletion only of those keys after a default 30-day age check, within the same target and public base. It never lists or clears an entire bucket. Ensure no live deployment still references the old manifest before deleting. There is no automatic GC.

Configure CDN `Cache-Control: public, max-age=31536000, immutable` for hashed objects; Bunny Pull Zone caching is configured separately (Storage API does not guarantee edge policy). Supabase uses max-age 31536000, with immutable filenames rather than a promised immutable response directive. Vercel Blob uses explicit public store URLs and no random suffix. Use a public origin that serves exactly the configured base; mismatches fail the build.

Verified locally: real Vite generation/URL rewriting, manifests, incremental skip, transient retry, permission failure, corrupt metadata, dry-run and safe GC. No live upload was performed without cloud credentials. Account permissions, network policy, egress and billing must be verified in a staging bucket before enabling production publication.

Sources checked 2026-10-20: [AWS SDK v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/), [R2 S3 compatibility](https://developers.cloudflare.com/r2/api/s3/api/), [Bunny Storage](https://docs.bunny.net/reference/storage-api), [Backblaze S3](https://www.backblaze.com/docs/cloud-storage-s3-compatible-api), [Vercel Blob SDK](https://vercel.com/docs/vercel-blob/using-blob-sdk), [Supabase standard uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads).

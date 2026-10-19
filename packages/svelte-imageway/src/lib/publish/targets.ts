import type { StorageTarget } from './index.js';
import { invariant, ImagewayError } from '../core/errors.js';
function credential(variable: string): string {
  const value = process.env[variable];
  invariant(value, 'CREDENTIAL', `Set environment variable ${variable} for publication.`, 500);
  return value;
}
function https(value: string): string {
  const u = new URL(value);
  invariant(
    u.protocol === 'https:' && !u.username && !u.password && !u.search && !u.hash,
    'STORAGE_URL',
    'Storage endpoint must use HTTPS without credentials/query.',
  );
  return u.href.replace(/\/$/, '');
}
/** AWS SDK v3, optional peer used only by this server-only factory. Covers R2, S3, B2 and compatible stores. */
export async function s3(options: {
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyEnv?: string;
  secretKeyEnv?: string;
  forcePathStyle?: boolean;
}): Promise<StorageTarget> {
  const sdk = await import('@aws-sdk/client-s3').catch(() => {
    throw new ImagewayError(
      'STORAGE_SDK',
      'Install @aws-sdk/client-s3 to publish to S3/R2/B2.',
      500,
    );
  });
  const endpoint = options.endpoint ? https(options.endpoint) : undefined;
  const client = new sdk.S3Client({
    region: options.region,
    endpoint,
    forcePathStyle: options.forcePathStyle,
    maxAttempts: 1,
    requestHandler: { requestTimeout: 30000, connectionTimeout: 5000 },
    ...(options.accessKeyEnv || options.secretKeyEnv
      ? {
          credentials: {
            accessKeyId: credential(options.accessKeyEnv ?? 'AWS_ACCESS_KEY_ID'),
            secretAccessKey: credential(options.secretKeyEnv ?? 'AWS_SECRET_ACCESS_KEY'),
          },
        }
      : {}),
  });
  return {
    id: `s3:${endpoint ?? options.region}:${options.bucket}`,
    async head(Key) {
      try {
        const r = await client.send(new sdk.HeadObjectCommand({ Bucket: options.bucket, Key }));
        return { size: r.ContentLength ?? 0, hash: r.Metadata?.sha256 };
      } catch (e) {
        if ((e as { $metadata?: { httpStatusCode: number } }).$metadata?.httpStatusCode === 404)
          return;
        throw e;
      }
    },
    async put(Key, Body, m) {
      await client.send(
        new sdk.PutObjectCommand({
          Bucket: options.bucket,
          Key,
          Body,
          ContentType: m.contentType,
          CacheControl: m.cacheControl,
          Metadata: { sha256: m.hash },
        }),
      );
    },
    async delete(Key) {
      await client.send(new sdk.DeleteObjectCommand({ Bucket: options.bucket, Key }));
    },
  };
}
export const r2 = (options: {
  accountId: string;
  bucket: string;
  accessKeyEnv?: string;
  secretKeyEnv?: string;
}) => {
  invariant(/^[a-f0-9]{32}$/.test(options.accountId), 'ACCOUNT', 'Invalid R2 account ID.');
  return s3({
    ...options,
    region: 'auto',
    endpoint: `https://${options.accountId}.r2.cloudflarestorage.com`,
  });
};
export const backblaze = (options: Parameters<typeof s3>[0]) => s3(options);
/** Bunny Storage HTTP API. Configure immutable cache policy on the Pull Zone; storage headers alone do not set its CDN policy. */
export function bunnyStorage(options: {
  endpoint?: string;
  zone: string;
  accessKeyEnv?: string;
}): StorageTarget {
  invariant(/^[\w-]+$/.test(options.zone), 'STORAGE_ZONE', 'Invalid Bunny storage zone.');
  const base = https(options.endpoint ?? 'https://storage.bunnycdn.com');
  async function call(key: string, init: RequestInit) {
    const response = await fetch(
      `${base}/${options.zone}/${key.split('/').map(encodeURIComponent).join('/')}`,
      {
        ...init,
        headers: {
          ...init.headers,
          AccessKey: credential(options.accessKeyEnv ?? 'BUNNY_STORAGE_KEY'),
        },
        redirect: 'error',
        signal: AbortSignal.timeout(30000),
      },
    );
    if (response.status !== 404 && !response.ok)
      throw Object.assign(new Error(`Bunny storage returned ${response.status}.`), {
        status: response.status,
      });
    return response;
  }
  return {
    id: `bunny:${base}:${options.zone}`,
    async head(key) {
      const r = await call(key, { method: 'HEAD' });
      return r.status === 404 ? undefined : { size: Number(r.headers.get('content-length')) };
    },
    async put(key, bytes, m) {
      const r = await call(key, {
        method: 'PUT',
        body: new Uint8Array(bytes),
        headers: { 'Content-Type': m.contentType, Checksum: m.hash.toUpperCase() },
      });
      invariant(r.ok, 'UPLOAD', 'Bunny upload failed.', 502);
      await r.body?.cancel();
    },
    async delete(key) {
      const r = await call(key, { method: 'DELETE' });
      await r.body?.cancel();
    },
  };
}
export async function vercelBlob(options: {
  publicBase: string;
  tokenEnv?: string;
}): Promise<StorageTarget> {
  const sdk = await import('@vercel/blob').catch(() => {
    throw new ImagewayError('STORAGE_SDK', 'Install @vercel/blob.', 500);
  });
  const base = https(options.publicBase);
  const token = credential(options.tokenEnv ?? 'BLOB_READ_WRITE_TOKEN');
  return {
    id: `vercel-blob:${base}`,
    async head(key) {
      try {
        const r = await sdk.head(base + '/' + key, { token });
        return { size: r.size };
      } catch (e) {
        if (e instanceof sdk.BlobNotFoundError) return;
        throw e;
      }
    },
    async put(key, bytes, m) {
      const r = await sdk.put(key, Buffer.from(bytes), {
        token,
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: false,
        contentType: m.contentType,
        cacheControlMaxAge: 31536000,
      });
      invariant(
        r.url === base + '/' + key,
        'BLOB_BASE',
        'Blob publicBase differs from actual store URL.',
        500,
      );
    },
    async delete(key) {
      await sdk.del(base + '/' + key, { token });
    },
  };
}
export async function supabaseStorage(options: {
  base: string;
  bucket: string;
  tokenEnv?: string;
}): Promise<StorageTarget> {
  const { StorageClient } = await import('@supabase/storage-js').catch(() => {
    throw new ImagewayError('STORAGE_SDK', 'Install @supabase/storage-js.', 500);
  });
  const base = https(options.base);
  const token = credential(options.tokenEnv ?? 'SUPABASE_SERVICE_ROLE_KEY');
  const bucket = new StorageClient(base + '/storage/v1', {
    Authorization: `Bearer ${token}`,
    apikey: token,
  }).from(options.bucket);
  return {
    id: `supabase:${base}:${options.bucket}`,
    async head(key) {
      const r = await bucket.info(key);
      if (r.error) {
        if ('status' in r.error && Number(r.error.status) === 404) return;
        throw r.error;
      }
      return { size: Number(r.data.metadata?.size ?? 0) };
    },
    async put(key, bytes, m) {
      const r = await bucket.upload(key, bytes, {
        cacheControl: '31536000',
        contentType: m.contentType,
        upsert: true,
        metadata: { sha256: m.hash },
      });
      if (r.error) throw r.error;
    },
    async delete(key) {
      const r = await bucket.remove([key]);
      if (r.error) throw r.error;
    },
  };
}

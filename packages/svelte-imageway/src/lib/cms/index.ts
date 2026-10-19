import { provider, dimensions } from '../providers/shared.js';
import { asset, basic, centered, query, format } from '../providers/url-tools.js';
import { imgix } from '../providers/imgix.js';
import { invariant } from '../core/errors.js';
import type { ImageArtifact } from '../core/types.js';
export type CmsKind =
  | 'sanity'
  | 'contentful'
  | 'directus'
  | 'storyblok'
  | 'prismic'
  | 'datocms'
  | 'shopify'
  | 'unsplash'
  | 'strapi'
  | 'wordpress';
/** Self-hosted CMS products need a hint: arbitrary domains cannot identify their software reliably. */
export function recognizeCms(source: string): CmsKind | undefined {
  const u = new URL(source);
  const h = u.hostname;
  if (h === 'cdn.sanity.io') return 'sanity';
  if (['images.ctfassets.net', 'images.contentful.com', 'images.eu.ctfassets.net'].includes(h))
    return 'contentful';
  if (h === 'a.storyblok.com') return 'storyblok';
  if (h === 'images.prismic.io') return 'prismic';
  if (h === 'www.datocms-assets.com') return 'datocms';
  if (h === 'cdn.shopify.com') return 'shopify';
  if (h === 'images.unsplash.com') return 'unsplash';
}
/** Public unsigned CMS URLs. Preserve attribution/crop query data; signed URLs need a server signer. */
export function cms(options: { kind: CmsKind; base: string }) {
  const { kind, base } = options;
  invariant(
    !['strapi', 'wordpress'].includes(kind),
    'CMS_VARIANTS',
    'Strapi/WordPress expose pre-generated variants. Use cmsArtifact() with their media response or configure an optimizer origin.',
  );
  if (['prismic', 'datocms', 'unsplash'].includes(kind)) {
    const p = imgix({ base });
    return { ...p, name: kind, descriptor: { factory: 'cms', options } };
  }
  return provider(
    kind,
    {
      ...basic,
      formats: kind === 'shopify' ? ['webp', 'jpeg', 'png'] : ['avif', 'webp', 'jpeg', 'png'],
      explicitFormat: kind !== 'shopify',
    },
    (r) => {
      centered(r);
      const u = asset(base, r);
      const d = dimensions(r);
      invariant(
        ![...u.searchParams.keys()].some((k) =>
          /^(token|sig|signature|s|policy|expires|x-amz-)/i.test(k),
        ),
        'SIGNED_SOURCE',
        'Do not modify signed CMS URLs; generate a new server signature.',
      );
      if (kind === 'sanity')
        return query(u, {
          ...d,
          fit: 'max',
          q: r.q,
          fm: r.format === 'auto' ? undefined : format(r),
          auto: r.format === 'auto' ? 'format' : undefined,
        });
      if (kind === 'contentful') {
        u.searchParams.delete('fit');
        return query(u, { ...d, q: r.q, fm: r.format === 'auto' ? undefined : format(r) });
      }
      if (kind === 'directus')
        return query(u, {
          width: d.w,
          height: d.h,
          fit: 'inside',
          quality: r.q,
          format: r.format === 'auto' ? undefined : r.format,
        });
      if (kind === 'shopify') {
        invariant(r.format === 'auto', 'CAPABILITY', 'Shopify negotiates formats; use auto.', 422);
        return query(u, { width: d.w, height: d.h });
      }
      invariant(
        kind === 'storyblok' && !u.search && !u.pathname.includes('/m/'),
        'CMS_SOURCE',
        'Use an original unsigned Storyblok image.',
      );
      return `${u.href}/m/fit-in/${d.w ?? 0}x${d.h ?? 0}/filters:quality(${r.q})${r.format === 'auto' ? '' : ':format(' + format(r) + ')'}`;
    },
    { factory: 'cms', options },
  );
}
export interface CmsVariant {
  url: string;
  width: number;
  height: number;
  mime?: string;
}
/** Adapt Strapi formats or WordPress media_details.sizes after mapping source_url to url. No fictitious transform API. */
export function cmsArtifact(
  original: CmsVariant,
  variants: readonly CmsVariant[] = [],
  origin?: string,
): ImageArtifact {
  const resolve = (value: string) => {
    const u = new URL(value, origin);
    invariant(
      u.protocol === 'https:' && !u.username && !u.password,
      'CMS_URL',
      'CMS variants require public HTTPS URLs.',
    );
    return u.href;
  };
  const items = [...variants, original]
    .filter(
      (v) => Number.isInteger(v.width) && v.width > 0 && Number.isInteger(v.height) && v.height > 0,
    )
    .sort((a, b) => a.width - b.width);
  invariant(
    items.length && original.width > 0 && original.height > 0,
    'CMS_DIMENSIONS',
    'CMS response requires intrinsic dimensions.',
  );
  const groups = new Map<string, CmsVariant[]>();
  for (const item of items) {
    const mime = item.mime ?? 'image/jpeg';
    invariant(/^image\/(jpeg|png|webp|avif|gif)$/.test(mime), 'CMS_MIME', 'Unsupported CMS MIME.');
    groups.set(mime, [...(groups.get(mime) ?? []), item]);
  }
  const srcset = (list: CmsVariant[]) =>
    [...new Map(list.map((v) => [v.width, v])).values()]
      .map((v) => `${resolve(v.url)} ${v.width}w`)
      .join(', ');
  const mime = original.mime ?? 'image/jpeg';
  return {
    src: resolve(original.url),
    srcset: srcset(groups.get(mime)!),
    sources: [...groups]
      .filter(([type]) => type !== mime)
      .map(([type, list]) => ({ type, srcset: srcset(list) })),
    width: original.width,
    height: original.height,
    aspectRatio: original.width / original.height,
  };
}

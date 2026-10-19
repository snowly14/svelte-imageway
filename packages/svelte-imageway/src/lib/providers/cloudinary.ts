import { provider, dimensions } from './shared.js';
import { basic, centered, format } from './url-tools.js';
import { invariant } from '../core/errors.js';
/** Uploaded public IDs or remote fetch URLs; strict transformations must be enabled in your account. */
export function cloudinary(options: { cloudName: string }) {
  invariant(/^[\w-]+$/.test(options.cloudName), 'PROVIDER', 'Invalid Cloudinary cloud name.');
  return provider(
    'cloudinary',
    {
      ...basic,
      formats: ['avif', 'webp', 'jpeg', 'png'],
      fit: ['inside', 'cover', 'contain', 'fill', 'scale-down'],
    },
    (r) => {
      centered(r);
      const d = dimensions(r);
      const mode = {
        inside: 'limit',
        'scale-down': 'limit',
        cover: 'fill',
        contain: 'pad',
        fill: 'scale',
        outside: '',
      }[r.fit];
      const tr = [`c_${mode}`, d.w && `w_${d.w}`, d.h && `h_${d.h}`, `q_${r.q}`, `f_${format(r)}`]
        .filter(Boolean)
        .join(',');
      const src = r.url
        ? encodeURI(r.url).replace(/[,#?]/g, encodeURIComponent)
        : r.key!.split('/').map(encodeURIComponent).join('/');
      return `https://res.cloudinary.com/${options.cloudName}/image/${r.url ? 'fetch' : 'upload'}/${tr}/${src}`;
    },
    { factory: 'cloudinary', options },
  );
}

import { error } from '@sveltejs/kit';
import { articles } from '#lib/server/articles.js';
export function entries() {
  return articles.map((v) => ({ slug: v.slug }));
}
export function load({ params }: { params: { slug: string } }) {
  const article = articles.find((v) => v.slug === params.slug);
  if (!article) error(404, 'Article not found');
  return { article };
}

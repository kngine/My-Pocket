import { Article } from '@/lib/storage';
import { normalizeUrl } from '@/lib/url';

export async function fetchArticleFromUrl(
  url: string,
  signal?: AbortSignal
): Promise<Article> {
  const normalizedUrl = normalizeUrl(url);

  const res = await fetch('/api/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: normalizedUrl }),
    signal,
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(data?.error || 'Failed to parse the URL');
  }

  return data as Article;
}

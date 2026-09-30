import { z } from 'zod';
import type { NewsArticle, NewsSearch } from '../../application/news/ports.ts';

const itemSchema = z.object({ title: z.string().max(1000), originallink: z.string().max(2000), link: z.string().max(2000),
  description: z.string().max(4000), pubDate: z.string().max(100) });
const responseSchema = z.object({ items: z.array(itemSchema).max(100) });

/** Removes Naver's <b> highlighting and common HTML entities; the text is display-only. */
export function plainText(value: string): string {
  return value.replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}
const httpsUrl = (value: string) => { try { return new URL(value).protocol === 'https:' ? value : null; } catch { return null; } };

/** Naver news search (newest first). Credentials stay server-side; responses are validated. */
export function createNaverNewsSearch(config: { clientId: string; clientSecret: string },
  fetcher: typeof fetch = fetch, timeoutMs = 10000): NewsSearch {
  return {
    provider: 'naver-news',
    async search(query) {
      const url = `https://openapi.naver.com/v1/search/news.json?${new URLSearchParams({ query, display: '20', sort: 'date' })}`;
      const response = await fetcher(url, { redirect: 'error', signal: AbortSignal.timeout(timeoutMs),
        headers: { 'X-Naver-Client-Id': config.clientId, 'X-Naver-Client-Secret': config.clientSecret } });
      if (!response.ok) throw new Error(`news_provider_${response.status}`);
      const body = responseSchema.parse(await response.json());
      return body.items.flatMap((item): NewsArticle[] => {
        const link = httpsUrl(item.link) ?? httpsUrl(item.originallink);
        const published = Date.parse(item.pubDate);
        if (!link || !Number.isFinite(published)) return [];
        return [{ title: plainText(item.title), description: plainText(item.description), link,
          originalLink: httpsUrl(item.originallink), publishedAt: new Date(published).toISOString() }];
      });
    },
  };
}

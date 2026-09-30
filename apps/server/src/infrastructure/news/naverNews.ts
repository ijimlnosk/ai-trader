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
/** Publisher links may be http; anything else (javascript:, data:, relative) is dropped. */
const webUrl = (value: string) => { try { return ['https:', 'http:'].includes(new URL(value).protocol) ? value : null; } catch { return null; } };

/**
 * NAVER API Hub (NCP) news search, API code NAVER_SCH_NEWS, newest first. Credentials are the NCP
 * application key pair and stay server-side; responses are validated.
 */
export function createNaverNewsSearch(config: { clientId: string; clientSecret: string },
  fetcher: typeof fetch = fetch, timeoutMs = 10000): NewsSearch {
  return {
    provider: 'naver-api-hub-news',
    async search(query) {
      const url = `https://naverapihub.apigw.ntruss.com/search/v1/news?${new URLSearchParams({ query, display: '20', sort: 'date' })}`;
      const response = await fetcher(url, { redirect: 'error', signal: AbortSignal.timeout(timeoutMs),
        headers: { 'X-NCP-APIGW-API-KEY-ID': config.clientId, 'X-NCP-APIGW-API-KEY': config.clientSecret } });
      if (!response.ok) throw new Error(`news_provider_${response.status}`);
      const body = responseSchema.parse(await response.json());
      return body.items.flatMap((item): NewsArticle[] => {
        const link = webUrl(item.link) ?? webUrl(item.originallink);
        const published = Date.parse(item.pubDate);
        if (!link || !Number.isFinite(published)) return [];
        return [{ title: plainText(item.title), description: plainText(item.description), link,
          originalLink: webUrl(item.originallink), publishedAt: new Date(published).toISOString() }];
      });
    },
  };
}

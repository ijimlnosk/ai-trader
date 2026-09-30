import { seoulOrderDate } from '../../domain/orders.ts';
import type { ApiQuota, NewsRepository, NewsSearch, QuotaCaps } from './ports.ts';

export interface NewsCollectionResult { calls: number; saved: number; failed: number; budgetExhausted: boolean }

/**
 * One news search per symbol. The budget is reserved before every call and a refusal stops the
 * run immediately, so the provider limit can never be exceeded even across restarts.
 */
export function createNewsCollector(deps: { search: NewsSearch; quota: ApiQuota; news: NewsRepository; caps: QuotaCaps;
  symbols: readonly (readonly [string, string])[]; now?: () => Date }) {
  const now = deps.now ?? (() => new Date());
  return async (): Promise<NewsCollectionResult> => {
    const result: NewsCollectionResult = { calls: 0, saved: 0, failed: 0, budgetExhausted: false };
    for (const [symbol, name] of deps.symbols) {
      const day = seoulOrderDate(now().toISOString());
      if (!await deps.quota.consume(deps.search.provider, day, day.slice(0, 6), deps.caps)) { result.budgetExhausted = true; break; }
      result.calls += 1;
      try {
        const query = `${name} 주가`;
        const articles = await deps.search.search(query);
        const collectedAt = now().toISOString();
        result.saved += await deps.news.save(articles.map((article) => ({ ...article, symbol, provider: deps.search.provider, query, collectedAt })));
      } catch { result.failed += 1; }
    }
    return result;
  };
}
export type NewsCollector = ReturnType<typeof createNewsCollector>;

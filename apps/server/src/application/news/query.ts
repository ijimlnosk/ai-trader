import type { ConsoleNewsResponse } from '@ai-trader/contracts';
import { seoulOrderDate } from '../../domain/orders.ts';
import { universeName } from '../../domain/market/universe.ts';
import type { ApiQuota, NewsRepository, QuotaCaps } from './ports.ts';

export function createNewsQuery(deps: { news: NewsRepository; quota?: ApiQuota | undefined; provider: string; caps: QuotaCaps; now?: () => Date }) {
  return async (limit: number): Promise<ConsoleNewsResponse> => {
    const day = seoulOrderDate((deps.now ?? (() => new Date()))().toISOString());
    const [items, usage] = await Promise.all([deps.news.recent(limit), deps.quota?.usage(deps.provider, day, day.slice(0, 6))]);
    return {
      items: items.map((item) => ({ id: item.id, symbol: item.symbol, name: universeName(item.symbol) ?? item.symbol, title: item.title,
        description: item.description, link: item.link, publishedAt: item.publishedAt })),
      usage: usage ? { provider: deps.provider, ...usage, dailyCap: deps.caps.daily, monthlyCap: deps.caps.monthly } : null,
    };
  };
}
export type NewsQuery = ReturnType<typeof createNewsQuery>;

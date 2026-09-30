import { describe, expect, it, vi } from 'vitest';
import type { ApiQuota, NewsRepository, NewsSearch } from './ports.ts';
import { createNewsCollector } from './collect.ts';

function memoryQuota(): ApiQuota & { used: Map<string, number> } {
  const used = new Map<string, number>();
  return {
    used,
    async consume(provider, day, month, caps) {
      const [d, m] = [`${provider}:d:${day}`, `${provider}:m:${month}`];
      if ((used.get(d) ?? 0) >= caps.daily || (used.get(m) ?? 0) >= caps.monthly) return false;
      used.set(d, (used.get(d) ?? 0) + 1); used.set(m, (used.get(m) ?? 0) + 1);
      return true;
    },
    async usage(provider, day, month) {
      return { daily: used.get(`${provider}:d:${day}`) ?? 0, monthly: used.get(`${provider}:m:${month}`) ?? 0 };
    },
  };
}
const article = (n: number) => ({ title: `t${n}`, description: 'd', link: `https://news.example/${n}`, originalLink: null, publishedAt: '2026-09-30T00:00:00.000Z' });
const symbols = [['005930', '삼성전자'], ['000660', 'SK하이닉스'], ['373220', 'LG에너지솔루션']] as const;

function setup(caps = { daily: 100, monthly: 1000 }) {
  const quota = memoryQuota();
  const search = { provider: 'naver-news', search: vi.fn<NewsSearch['search']>(async () => [article(1), article(2)]) };
  const news = { save: vi.fn<NewsRepository['save']>(async (items) => items.length), recent: vi.fn() };
  const collect = createNewsCollector({ search, quota, news, caps, symbols, now: () => new Date('2026-09-30T00:00:00Z') });
  return { quota, search, news, collect };
}

describe('news collector budget', () => {
  it('reserves one call per symbol and archives results with the query', async () => {
    const s = setup();
    expect(await s.collect()).toEqual({ calls: 3, saved: 6, failed: 0, budgetExhausted: false });
    expect(s.search.search.mock.calls.map(([query]) => query)).toEqual(['삼성전자 주가', 'SK하이닉스 주가', 'LG에너지솔루션 주가']);
    expect(s.news.save.mock.calls[0]![0][0]).toMatchObject({ symbol: '005930', provider: 'naver-news', query: '삼성전자 주가' });
    expect(await s.quota.usage('naver-news', '20260930', '202609')).toEqual({ daily: 3, monthly: 3 });
  });

  it('never makes a call beyond the daily cap, exactly at the limit', async () => {
    const s = setup({ daily: 2, monthly: 1000 });
    expect(await s.collect()).toMatchObject({ calls: 2, budgetExhausted: true });
    expect(s.search.search).toHaveBeenCalledTimes(2);
    expect(await s.collect()).toMatchObject({ calls: 0, budgetExhausted: true });
    expect(s.search.search).toHaveBeenCalledTimes(2);
  });

  it('never makes a call beyond the monthly cap', async () => {
    const s = setup({ daily: 100, monthly: 1 });
    expect(await s.collect()).toMatchObject({ calls: 1, budgetExhausted: true });
    expect(s.search.search).toHaveBeenCalledTimes(1);
  });

  it('counts failed calls against the budget and continues with the next symbol', async () => {
    const s = setup({ daily: 3, monthly: 1000 });
    s.search.search.mockRejectedValueOnce(new Error('news_provider_500'));
    expect(await s.collect()).toEqual({ calls: 3, saved: 4, failed: 1, budgetExhausted: false });
    expect(await s.collect()).toMatchObject({ calls: 0, budgetExhausted: true });
  });
});

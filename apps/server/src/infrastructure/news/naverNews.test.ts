import { expect, it, vi } from 'vitest';
import { createNaverNewsSearch, plainText } from './naverNews.ts';

const config = { clientId: 'fixture-id', clientSecret: 'fixture-secret' };
const item = { title: '<b>삼성전자</b> &quot;반등&quot;', originallink: 'https://origin.example/a', link: 'https://n.news.naver.com/a',
  description: '설명 &amp; 요약', pubDate: 'Tue, 30 Sep 2026 08:15:00 +0900' };
const ok = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

it('queries newest news with server-side credentials and normalizes items', async () => {
  const fetcher = ok({ items: [item, { ...item, link: 'javascript:alert(1)', originallink: 'http://x' }, { ...item, pubDate: 'nope' }] });
  const articles = await createNaverNewsSearch(config, fetcher as unknown as typeof fetch).search('삼성전자 주가');
  expect(articles).toEqual([{ title: '삼성전자 "반등"', description: '설명 & 요약', link: 'https://n.news.naver.com/a',
    originalLink: 'https://origin.example/a', publishedAt: '2026-09-29T23:15:00.000Z' }]);
  const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe('https://openapi.naver.com/v1/search/news.json?query=%EC%82%BC%EC%84%B1%EC%A0%84%EC%9E%90+%EC%A3%BC%EA%B0%80&display=20&sort=date');
  expect(init).toMatchObject({ redirect: 'error', headers: { 'X-Naver-Client-Id': 'fixture-id', 'X-Naver-Client-Secret': 'fixture-secret' } });
});

it('rejects error statuses and malformed bodies without echoing credentials', async () => {
  await expect(createNaverNewsSearch(config, ok({ errorMessage: 'x' }, 429) as unknown as typeof fetch).search('q')).rejects.toThrow('news_provider_429');
  await expect(createNaverNewsSearch(config, ok({ items: 'no' }) as unknown as typeof fetch).search('q')).rejects.not.toThrow('fixture-secret');
});

it('strips markup and entities', () => {
  expect(plainText('<b>A</b>&lt;B&gt; &#39;C&#39;\n  D')).toBe("A<B> 'C' D");
});

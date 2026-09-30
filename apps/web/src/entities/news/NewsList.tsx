'use client';
import { formatDecimal, formatRelative } from '@/shared/lib/format';
import { Card, Empty } from '@/shared/ui/Card';
import { useNews } from './queries';

/** Archived headlines for the universe. Informational only; they never place orders. */
export function NewsList() {
  const query = useNews();
  const items = query.data?.items ?? [];
  const usage = query.data?.usage;
  return (
    <Card title="종목 뉴스" updatedAt={query.dataUpdatedAt} isLoading={query.isLoading} error={query.error}>
      {items.length === 0 ? <Empty icon="📰">아직 수집된 뉴스가 없어요</Empty> : (
        <ul className="rows">{items.map((item) => (
          <li className="row" key={item.id}>
            <div className="row-main">
              <span className="news-meta"><span className="news-symbol">{item.name}</span><span className="subtle">{formatRelative(item.publishedAt)}</span></span>
              <a className="news-title" href={item.link} target="_blank" rel="noopener noreferrer">{item.title}</a>
              {item.description && <span className="subtle news-desc">{item.description}</span>}
            </div>
          </li>))}
        </ul>)}
      {usage && <p className="footnote">네이버 뉴스 호출 오늘 {formatDecimal(String(usage.daily))}/{formatDecimal(String(usage.dailyCap))}회 · 이번 달 {formatDecimal(String(usage.monthly))}/{formatDecimal(String(usage.monthlyCap))}회 (자체 상한)</p>}
      <p className="footnote">뉴스는 참고용이며 현재 자동매매 판단에는 쓰이지 않아요.</p>
    </Card>
  );
}

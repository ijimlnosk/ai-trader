'use client';
import { formatSessionDate } from '@/shared/lib/format';
import { Card, Empty } from '@/shared/ui/Card';
import { useInsights } from './queries';

/** Recent DART filings of universe symbols. Archived for a future filter; they do not affect orders. */
export function DisclosuresCard() {
  const query = useInsights();
  const items = query.data?.disclosures ?? [];
  return (
    <Card title="최근 공시 (DART)" updatedAt={query.dataUpdatedAt} isLoading={query.isLoading} error={query.error}>
      {items.length === 0 ? <Empty icon="📄">아직 수집된 공시가 없어요</Empty> : (
        <ul className="rows">{items.map((item) => (
          <li className="row" key={item.receiptNo}>
            <div className="row-main">
              <span className="news-meta"><span className="news-symbol">{item.name}</span><span className="subtle">{formatSessionDate(item.receiptDate)}</span></span>
              <a className="news-title" href={`https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${item.receiptNo}`} target="_blank" rel="noopener noreferrer">{item.reportName}</a>
            </div>
          </li>))}
        </ul>)}
      <p className="footnote">매 거래일 08:15에 최근 7일치를 모아요. 지금은 기록만 하고 매매 판단에는 쓰지 않아요.</p>
    </Card>
  );
}

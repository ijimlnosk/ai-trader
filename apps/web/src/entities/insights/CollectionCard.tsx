'use client';
import { formatSessionDate } from '@/shared/lib/format';
import { Card, Empty } from '@/shared/ui/Card';
import { useInsights } from './queries';

const UNIVERSE_SIZE = 54;

function CoverageRows({ items }: { items: { date: string; symbols: number; minBars: number; maxBars: number }[] }) {
  if (items.length === 0) return <Empty icon="🗂️">아직 수집된 데이터가 없어요</Empty>;
  return (
    <ul className="rows">{items.map((item) => (
      <li className="row" key={item.date}>
        <div className="row-main"><strong>{formatSessionDate(item.date)}</strong></div>
        <div className="row-end">
          <span>{item.symbols}/{UNIVERSE_SIZE}종목</span>
          <span className="subtle">{item.minBars === item.maxBars ? `${item.minBars}봉` : `${item.minBars}~${item.maxBars}봉`}</span>
        </div>
      </li>))}
    </ul>
  );
}

/** What has been archived per session: completed daily history and intraday minute bars. */
export function CollectionCard() {
  const query = useInsights();
  const collection = query.data?.collection;
  return (
    <Card title="데이터 수집 현황" updatedAt={query.dataUpdatedAt} isLoading={query.isLoading} error={query.error}>
      <h3 className="subtle">일봉 (매수 판단용, 종목당 최대 184봉)</h3>
      <CoverageRows items={(collection?.daily ?? []).map((item) => ({ ...item, date: item.through }))} />
      <h3 className="subtle">분봉 (장중 전략 연구용, 하루 391봉)</h3>
      <CoverageRows items={(collection?.minute ?? []).map((item) => ({ ...item, date: item.sessionDate }))} />
    </Card>
  );
}

'use client';
import { formatDecimal, formatKrw, formatSignedKrw, toneOf } from '@/shared/lib/format';
import { Card } from '@/shared/ui/Card';
import { usePortfolio } from './queries';

/** The first thing on screen: total value and unrealized result, large and calm. */
export function PortfolioSummary() {
  const query = usePortfolio();
  const p = query.data;
  const tone = toneOf(p?.totalProfitLoss);
  return (
    <Card className="hero" updatedAt={query.dataUpdatedAt} isLoading={query.isLoading} error={query.error} title="내 모의투자 계좌">
      {p && <>
        <p className="hero-value num">{formatKrw(p.totalEvaluation)}</p>
        <p className={`hero-delta num tone-${tone}`}>
          {formatSignedKrw(p.totalProfitLoss)} <span>({tone === 'up' ? '+' : ''}{formatDecimal(p.totalProfitLossRate)}%)</span>
          <span className="subtle"> 평가손익</span>
        </p>
        <dl className="facts">
          <div><dt>예수금</dt><dd className="num">{formatKrw(p.cash)}</dd></div>
          <div><dt>매입금액</dt><dd className="num">{formatKrw(p.totalPurchaseAmount)}</dd></div>
          <div><dt>보유 종목</dt><dd className="num">{p.positions.length}개</dd></div>
        </dl>
      </>}
    </Card>
  );
}

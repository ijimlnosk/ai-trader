'use client';
import { formatDecimal, formatKrw, formatSeoulTime, formatSessionDate, formatSignedKrw, toneOf } from '@/shared/lib/format';
import { Card, Empty } from '@/shared/ui/Card';
import { Chip } from '@/shared/ui/Chip';
import type { ConsoleInsightsResponse } from '@ai-trader/contracts';
import { useInsights } from './queries';

const REASONS: Record<string, string> = { ENTRY: '오전 강세 매수', REBUY: '되돌림 재매수', TARGET: '+5% 도달', TRAIL: '고점 대비 하락', STOP: '−3% 손절', CLOSE: '장 마감 정리',
  ROTATE_IN: '주간 상위 편입', ROTATE_OUT: '주간 순위 이탈' };
type Ledger = ConsoleInsightsResponse['shadows'][number];

/** Virtual KRW 500,000 ledgers on live quotes, one card each. Nothing here is a real order. */
export function ShadowTradingCards() {
  const query = useInsights();
  const shadows = query.data?.shadows ?? [];
  if (shadows.length === 0) return <Card title="가상 운용 (50만원, 주문 없음)" updatedAt={query.dataUpdatedAt} isLoading={query.isLoading} error={query.error}>
    <Empty icon="🧪">가상 운용이 아직 켜져 있지 않아요</Empty></Card>;
  return <>{shadows.map((shadow) => <LedgerCard key={shadow.strategy} shadow={shadow} updatedAt={query.dataUpdatedAt} />)}</>;
}

function LedgerCard({ shadow, updatedAt }: { shadow: Ledger; updatedAt: number }) {
  return (
    <Card title={`${shadow.label} · 50만원, 주문 없음`} updatedAt={updatedAt}>
      <>
        <p><span className="subtle">원금 {formatKrw(shadow.capitalKrw)} · </span>
          <strong className={`tone-${toneOf(shadow.realizedKrw)}`}>원금 외 실현 손익 {formatSignedKrw(shadow.realizedKrw)}</strong>
          <span className="subtle"> · 현금 {formatKrw(shadow.cashKrw)}</span></p>
        {shadow.holdings.length > 0 && <ul className="rows">{shadow.holdings.map((h) => (
          <li className="row" key={h.symbol}><div className="row-main"><strong>{h.name} {formatDecimal(h.quantity)}주</strong>
            <span className="subtle">매수가 {formatKrw(h.entryPrice)} · 원가 {formatKrw(h.costKrw)}</span></div><Chip tone="info">보유 중</Chip></li>))}</ul>}
        <h3 className="subtle">날짜별 성적</h3>
        {shadow.days.length === 0 ? <Empty icon="📅">아직 거래가 없어요 (거래일 09:10부터)</Empty> : (
          <ul className="rows">{shadow.days.map((d) => (
            <li className="row" key={d.sessionDate}><div className="row-main"><strong>{formatSessionDate(d.sessionDate)}</strong>
              <span className="subtle">{d.trades}건</span></div>
              <div className="row-end"><span className={`tone-${toneOf(d.realizedKrw)}`}>{formatSignedKrw(d.realizedKrw)}</span></div></li>))}</ul>)}
        {shadow.recent.length > 0 && <>
          <h3 className="subtle">최근 가상 체결</h3>
          <ul className="rows">{shadow.recent.map((t) => (
            <li className="row" key={`${t.createdAt}-${t.symbol}-${t.side}`}>
              <span className={`side side-${t.side.toLowerCase()}`}>{t.side === 'BUY' ? '매수' : '매도'}</span>
              <div className="row-main"><strong>{t.name} {formatDecimal(t.quantity)}주 · {formatKrw(t.fillPrice)}</strong>
                <span className="subtle">{REASONS[t.reason] ?? t.reason}</span></div>
              <div className="row-end"><span className="subtle">{formatSeoulTime(t.createdAt)}</span></div>
            </li>))}</ul></>}
        <p className="footnote">실시간 시세로 가상 체결만 기록해요. 수수료 0.02%, 슬리피지 0.1%, 주식 매도세 0.2%(ETF는 없음) 반영. 실제 주문은 나가지 않아요.</p>
      </>
    </Card>
  );
}

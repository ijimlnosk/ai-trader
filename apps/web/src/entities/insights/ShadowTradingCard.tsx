'use client';
import { formatDecimal, formatKrw, formatSeoulTime, formatSessionDate, formatSignedKrw, toneOf } from '@/shared/lib/format';
import { Card, Empty } from '@/shared/ui/Card';
import { Chip } from '@/shared/ui/Chip';
import { useInsights } from './queries';

const REASONS: Record<string, string> = { ENTRY: '오전 강세 매수', REBUY: '되돌림 재매수', TARGET: '+5% 도달', TRAIL: '고점 대비 하락', STOP: '−3% 손절', CLOSE: '장 마감 정리' };

/** Virtual KRW 500,000 day trading on live quotes. Nothing here is a real order. */
export function ShadowTradingCard() {
  const query = useInsights();
  const shadow = query.data?.shadow;
  return (
    <Card title="가상 단타 (50만원, 주문 없음)" updatedAt={query.dataUpdatedAt} isLoading={query.isLoading} error={query.error}>
      {!shadow ? <Empty icon="🧪">가상 단타가 아직 켜져 있지 않아요</Empty> : <>
        <p><strong className={`tone-${toneOf(shadow.realizedKrw)}`}>누적 실현 {formatSignedKrw(shadow.realizedKrw)}</strong>
          <span className="subtle"> · 현금 {formatKrw(shadow.cashKrw)} · 시작 {formatKrw(shadow.capitalKrw)}</span></p>
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
        <p className="footnote">실시간 시세로 가상 체결만 기록해요. 수수료 0.02%, 매도세 0.2%, 슬리피지 0.1% 반영. 실제 주문은 나가지 않아요.</p>
      </>}
    </Card>
  );
}

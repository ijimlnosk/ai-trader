'use client';
import { useConsoleStatus } from './queries';

/** Live must never look like paper; an unreadable status is shown as unverified. */
export function ModePill() {
  const s = useConsoleStatus().data;
  const mode = !s ? 'unknown' : s.tradingMode === 'live' || s.liveTradingEnabled ? 'live' : 'paper';
  return <span className={`mode-pill mode-${mode}`}>{mode === 'live' ? 'LIVE 실거래' : mode === 'paper' ? 'PAPER 모의투자' : '모드 확인 중'}</span>;
}

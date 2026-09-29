'use client';
import { formatSessionDate } from '@/shared/lib/format';
import { useBrokerStatus, useConsoleStatus, useHealth } from './queries';

/** Settings that can send orders are highlighted when ON; unknown values are always highlighted. */
const flag = (label: string, on: boolean | undefined, canSendOrders = true) => (
  <li className={on === undefined || (canSendOrders && on) ? 'flag warn' : 'flag'}>
    {label}: {on === undefined ? '?' : on ? 'ON' : 'OFF'}
  </li>
);

/** Live mode must never look like paper mode: unknown state is shown as unverified, not paper. */
export function SafetyBanner() {
  const status = useConsoleStatus();
  const health = useHealth();
  const broker = useBrokerStatus();
  const s = status.data;
  const live = s ? s.tradingMode === 'live' || s.liveTradingEnabled : undefined;
  const mode = live === undefined ? 'unknown' : live ? 'live' : 'paper';
  return (
    <header className={`banner banner-${mode}`}>
      <strong className="mode">{mode === 'live' ? 'LIVE 실거래' : mode === 'paper' ? 'PAPER 모의투자' : '모드 확인 불가'}</strong>
      <ul className="flags">
        {flag('Paper 주문 실행', s?.paperExecutionEnabled)}
        {flag('Paper loop', s?.paperLoopEnabled)}
        {flag('자동 tick', s?.paperLoopScheduleEnabled)}
        {flag('자동 수집', s?.marketDataScheduleEnabled, false)}
        {flag('Kill switch (BUY 중단)', s?.killSwitchEnabled, false)}
        <li className={health.data?.database === 'connected' ? 'flag' : 'flag warn'}>DB: {health.data?.database ?? '?'}</li>
        <li className={broker.data?.reachable ? 'flag' : 'flag warn'}>KIS: {broker.data ? (broker.data.reachable ? 'reachable' : broker.data.error ?? 'unreachable') : '?'}</li>
        <li className="flag">캘린더 {s ? `${s.calendar.version} ~${formatSessionDate(s.calendar.through)}` : '?'}</li>
      </ul>
      {status.error && <p className="warning">상태 조회 실패: {status.error.message}</p>}
    </header>
  );
}

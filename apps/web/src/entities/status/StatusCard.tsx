'use client';
import type { ConsoleStatusResponse } from '@ai-trader/contracts';
import { formatSessionDate } from '@/shared/lib/format';
import { Card } from '@/shared/ui/Card';
import { Chip, type ChipTone } from '@/shared/ui/Chip';
import { useControls } from '@/entities/controls/queries';
import { useBrokerStatus, useConsoleStatus, useHealth } from './queries';

function headline(s: ConsoleStatusResponse, autoTrading: boolean): { tone: ChipTone; title: string; detail: string } {
  if (s.tradingMode === 'live' || s.liveTradingEnabled) return { tone: 'danger', title: '실거래 모드', detail: '실제 돈으로 주문이 나갈 수 있어요.' };
  if (autoTrading) {
    return { tone: 'warn', title: '자동매매 켜짐', detail: '장중(09:05–15:00)에 전략이 모의 주문을 낼 수 있어요.' };
  }
  if (s.paperExecutionEnabled) return { tone: 'good', title: '자동 주문 꺼짐', detail: '자동매매가 꺼져 있어 새 주문을 내지 않아요.' };
  return { tone: 'good', title: '주문 꺼짐', detail: '지금은 어떤 주문도 나가지 않아요.' };
}

const item = (label: string, value: string, tone: ChipTone) => (
  <div className="status-item"><span>{label}</span><Chip tone={tone}>{value}</Chip></div>
);

export function StatusCard() {
  const status = useConsoleStatus();
  const health = useHealth();
  const broker = useBrokerStatus();
  const controls = useControls();
  const s = status.data;
  const h = s && controls.data ? headline(s, controls.data.autoTrading.effective) : null;
  const onOff = (on: boolean, orders = true): [string, ChipTone] => [on ? '켜짐' : '꺼짐', on ? (orders ? 'warn' : 'good') : 'neutral'];
  return (
    <Card title="운영 상태" updatedAt={status.dataUpdatedAt} isLoading={status.isLoading} error={status.error}>
      {s && h && <>
        <div className={`headline headline-${h.tone}`}><strong>{h.title}</strong><span>{h.detail}</span></div>
        <div className="status-grid">
          {item('서버 자동매매 허용', ...onOff(s.paperLoopScheduleEnabled))}
          {item('모의 주문 실행', ...onOff(s.paperExecutionEnabled))}
          {item('매매 루프', ...onOff(s.paperLoopEnabled))}
          {item('일봉 자동 수집', ...onOff(s.marketDataScheduleEnabled, false))}
          {item('매수 중단', s.killSwitchEnabled ? '켜짐' : '꺼짐', s.killSwitchEnabled ? 'info' : 'neutral')}
          {item('서버·DB', health.data?.database === 'connected' ? '정상' : health.isLoading ? '확인 중' : '문제', health.data?.database === 'connected' ? 'good' : health.isLoading ? 'neutral' : 'danger')}
          {item('KIS 연결', broker.data ? (broker.data.reachable ? '정상' : '문제') : '확인 중', broker.data ? (broker.data.reachable ? 'good' : 'danger') : 'neutral')}
          {item('휴장일 캘린더', `~${formatSessionDate(s.calendar.through).slice(5)}`, 'neutral')}
        </div>
      </>}
    </Card>
  );
}

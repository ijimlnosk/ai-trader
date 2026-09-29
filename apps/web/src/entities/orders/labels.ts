import type { ExecutionStatus } from '@ai-trader/contracts';
import type { ChipTone } from '@/shared/ui/Chip';

export const ORDER_STATUS: Record<ExecutionStatus, { label: string; tone: ChipTone }> = {
  PREPARING: { label: '준비 중', tone: 'info' }, SUBMITTING: { label: '전송 중', tone: 'info' },
  SUBMITTED: { label: '접수', tone: 'info' }, PARTIALLY_FILLED: { label: '부분 체결', tone: 'warn' },
  FILLED: { label: '체결', tone: 'good' }, CANCELLED: { label: '취소', tone: 'neutral' },
  BROKER_REJECTED: { label: '거부', tone: 'danger' }, RISK_REJECTED: { label: '리스크 거부', tone: 'neutral' },
  FAILED: { label: '실패', tone: 'danger' }, UNKNOWN: { label: '확인 필요', tone: 'danger' },
};
export const SIDE_LABEL = { BUY: '매수', SELL: '매도' } as const;

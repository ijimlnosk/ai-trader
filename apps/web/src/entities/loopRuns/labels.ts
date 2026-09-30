import type { ConsoleLoopStatus } from '@ai-trader/contracts';
import type { ChipTone } from '@/shared/ui/Chip';

export const RUN_STATUS: Record<ConsoleLoopStatus, { label: string; tone: ChipTone }> = {
  COMPLETE: { label: '완료', tone: 'good' }, TRACKING: { label: '체결 확인 중', tone: 'info' },
  CLAIMED: { label: '처리 중', tone: 'warn' }, HALTED: { label: '중단 · 확인 필요', tone: 'danger' },
};
export { reasonLabel } from '@/shared/lib/strategyLabels';

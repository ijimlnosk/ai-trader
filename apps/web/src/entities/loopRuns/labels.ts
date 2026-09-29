import type { ConsoleLoopStatus } from '@ai-trader/contracts';
import type { ChipTone } from '@/shared/ui/Chip';

export const RUN_STATUS: Record<ConsoleLoopStatus, { label: string; tone: ChipTone }> = {
  COMPLETE: { label: '완료', tone: 'good' }, TRACKING: { label: '체결 확인 중', tone: 'info' },
  CLAIMED: { label: '처리 중', tone: 'warn' }, HALTED: { label: '중단 · 확인 필요', tone: 'danger' },
};

/** Plain-language strategy reason; unknown codes are shown as-is. */
const REASONS: Record<string, string> = {
  BULLISH_CROSS: '상승 전환 → 매수 신호', TREND_EXIT: '추세 이탈 → 매도 신호', HOLD_POSITION: '보유 유지',
  NO_ENTRY: '매수 조건 아님', SCREENED_OUT: '종목 조건 미달', INSUFFICIENT_HISTORY: '데이터 부족',
  INVALID_VOLATILITY: '변동성 계산 불가', SIZE_UNAVAILABLE: '주문 수량 산정 불가',
};
export const reasonLabel = (code: string) => REASONS[code] ?? code;

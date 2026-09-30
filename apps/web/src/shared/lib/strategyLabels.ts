/** Plain-language strategy reason; unknown codes are shown as-is. */
const REASONS: Record<string, string> = {
  BULLISH_CROSS: '상승 전환 → 매수 신호', TREND_EXIT: '추세 이탈 → 매도 신호', HOLD_POSITION: '보유 유지',
  NO_ENTRY: '매수 조건 아님', SCREENED_OUT: '종목 조건 미달', INSUFFICIENT_HISTORY: '데이터 부족',
  INVALID_VOLATILITY: '변동성 계산 불가', SIZE_UNAVAILABLE: '주문 수량 산정 불가',
  MOMENTUM_ENTRY: '모멘텀 상위 → 매수', RANK_EXIT: '순위 하락 → 매도',
  TRIM: '비중 초과 → 일부 매도', NOT_REBALANCE_DAY: '교체일 아님',
};
export const reasonLabel = (code: string) => REASONS[code] ?? code;

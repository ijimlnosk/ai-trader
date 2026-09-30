# Universe backtest — 2026-09-30

## Setup

- Data: KIS `FHKST03010100`, raw daily bars, 54 universe symbols (`krx-liquid-2026-09-v1`),
  262 aligned sessions 2025-09-01 … 2026-09-29 (all symbols aligned, no fetch errors after retries).
  Archive: `/home/jinsol/ai-trader-backups/backtest-20260930/dataset.json` (SHA-256 prefix `aa9509ddbdc3318b`).
  Note: data covers the same universe chosen today (survivorship bias favours buy-and-hold).
- Engine: `runBacktest` now uses the live `planSession` ordering and sequential risk context
  (SELLs first, ranked BUYs, cash/slots consumed). Next-open fills; no look-ahead.
- Costs: commission 2 bp each side, sell tax 20 bp, slippage 5 bp. Initial cash KRW 10,000,000.
- Strategy/risk: unchanged defaults (EMA20/60 cross, RSI 50–70, volume ratio ≥ 1.2, 1% risk
  budget, 9% allocation; max 5 positions, 10% exposure, 2% daily loss, 3 consecutive losses).
  First possible decision 2025-12-02 (61-bar warm-up).

## Result

| | Value |
| --- | --- |
| Final equity | KRW 9,749,887 (−2.50%) |
| Max drawdown | 5.14% |
| Completed trades | 6 (all losses), 0 open at end |
| Equal-weight buy-and-hold (same window) | +29.63% |
| 005930 buy-and-hold | +169.27% |

Evaluations: 10,806 `NO_ENTRY`, 24 `BULLISH_CROSS`, 6 `TREND_EXIT`, 67 `HOLD_POSITION`.
30 proposals, 12 approved. All 18 rejections were `CONSECUTIVE_LOSS_LIMIT_EXCEEDED`.

## Findings

1. Entries are rare (24 in ~200 sessions × 54 symbols) and the exit (EMA20 < EMA60 or close <
   EMA60) closed every position at a loss within days to weeks (whipsaw).
2. After the third straight loss (2026-02-02) the consecutive-loss halt rejected every BUY for
   the rest of the period. The streak only resets on a winning sale, which cannot happen without
   new buys, so the halt is effectively permanent. The live account has the same rule.
3. The current strategy should not be connected to market-wide execution. Strategy research needs
   walk-forward (out-of-sample) validation on longer history before any change, and the
   consecutive-loss halt needs an explicit owner decision on how it resets (not a silent change).

# Intraday thresholds research (daily-bar proxy) — 2026-10-06

Research only; nothing here trades. Script: `research/intraday-thresholds.mjs`. Plan:
[intraday-thresholds](exec-plans/active/intraday-thresholds.md).

## Data and method

- Same dataset as the 2026-09-30 study: KIS raw daily bars 2023-08-01 … 2026-09-29, SHA-256 prefix
  `f4266dd77124a2fa`; 207940 and 086520 excluded for corporate actions; 51 symbols.
- In-sample 2024-08-23 … 2025-09-30, out-of-sample 2025-10-01 … 2026-09-29. Ranking uses in-sample only
  (CAGR / max(MDD, 5%), at least 10 trades).
- Momentum as in production (decision 0016): lookback and trend MA 120, daily rebalance, entry top 5,
  keep top 10, 9% of equity each, trim above 15%, at most 5 positions; decisions at close, fills next open.
- Intraday proxy: a touch of the day's high/low fills at the threshold, or at the open when it gaps past.
  Stop before target when both are touched. Levels come from the entry fill or the previous close.
- Costs 2 bp commission per side, 20 bp sell tax, 5 bp slippage. Start equity KRW 10,000,000.

## Results (return / max drawdown)

| Rule on momentum | In-sample | Out-of-sample |
| --- | --- | --- |
| Momentum only (current) | 37.5% / 9.7% | 22.8% / 26.3% |
| Take profit 30%, full sale, no re-entry for 5 sessions | 34.7% / 7.2% | 25.6% / 10.6% |
| Take profit 20% | 29.0% / 8.1% | 18.3% / 15.4% |
| Take profit 10% | 16.5% / 8.0% | 12.4% / 11.2% |
| Stop loss 7% | 35.4% / 9.4% | 20.0% / 30.7% |
| Stop loss 15% | 39.1% / 9.0% | 19.6% / 28.4% |

- Take profit around 30% kept the return and cut the out-of-sample drawdown from 26% to about 11%.
  Tighter targets (10–20%) cut returns sharply: they sell the winners momentum depends on.
- The 5-session re-entry block matters: without it momentum buys the same symbol back the next day
  (TP 30% + SL 10% without the block: out-of-sample 7.2%).
- Stop losses alone did not help: lower returns and larger drawdowns, win rate falling to about 20%.
- TP 30% + SL 15% + block had the best out-of-sample result (34.9% / 10.9%) but ranked second in-sample;
  choosing it because of the out-of-sample year would be selection on the test data.
- Standalone dip buying (3/5/7/10% below the previous close, hold 1/3/5 sessions) was unstable: median
  out-of-sample return 4.7%; the in-sample best (3% dip, above MA120, hold 5) returned 21.2% out of sample
  with about 200 trades a year, while the next ones were negative. Not supported.

## Limits

- Daily-bar proxy: assumes fills exactly at touched levels and an unknown intraday order. Minute bars
  (archived since 2026-10-01) are needed to confirm before any rule trades.
- One out-of-sample year in a strongly rising market; the universe is today's liquid names (survivorship).

## Recommendation

Candidate for the minute-bar check and an order-free dry run: take profit 30% (full sale) with a
5-session re-entry block on momentum holdings. No standalone stop loss and no dip buying for now.

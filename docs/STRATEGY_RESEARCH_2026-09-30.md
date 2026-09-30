# Strategy research (walk-forward) — 2026-09-30

Research only; nothing here trades. Script: `research/walk-forward.mjs`.

## Data and method

- KIS raw daily bars, 2023-08-01 … 2026-09-29 (768 sessions), 53 universe symbols (005930 missing
  early ranges after token errors). Archive: `/home/jinsol/ai-trader-backups/backtest-20260930/dataset3y.json`
  (SHA-256 prefix `f4266dd77124a2fa`).
- Two symbols excluded: moves beyond the KRX ±30% daily limit reveal corporate actions in raw
  prices (086520 −79% on 2024-04-25, a 5:1 split; 207940 +46% on 2025-11-24). 51 symbols remain.
- Decisions at close t, fills at open t+1; commission 2 bp/side, sell tax 20 bp, slippage 5 bp;
  at most 5 positions at 10% of equity each (current risk policy), no leverage.
- Parameters selected **only** on the in-sample window (2024-08-23 … 2025-09-30) by CAGR / max(MDD, 5%)
  with ≥ 10 trades; the out-of-sample year (2025-10-01 … 2026-09-29) was not used for selection.
- Families: momentum rotation (lookback 60/120/250, rebalance 5/20 sessions, trend MA 60/120,
  market filter off/100, keep-rank 5/10); Donchian breakout (entry 20/55, exit 10/20,
  trend MA 60/120/200, market filter off/100). 80 configurations.

## Results

| | In-sample return / MDD | Out-of-sample return / MDD |
| --- | --- | --- |
| Current EMA-cross strategy (1-year backtest) | — | −6.6% / 8.5% (with cooldown) |
| **Momentum 120-day, weekly, 120-MA exit, keep top 10** (selected) | **+40.0% / 10.1%** | **+41.2% / 46.6%** |
| Best breakout by in-sample (20/20, 200-MA, market filter) | +13.7% / 13.1% | +86.1% / 22.1% |
| Median of all 80 configurations | — | +35.2% |
| Equal-weight buy-and-hold, 100% invested | +41.3% / 14.1% | +49.3% / 35.4% |
| Equal-weight buy-and-hold, 50% invested (policy-comparable) | +20.6% / 7.4% | +24.6% / 23.5% |

## Interpretation

- Momentum rotation is the most consistent family: the configuration chosen in-sample stayed
  strong out-of-sample and roughly doubled the policy-comparable (50% invested) benchmark.
  It does not beat 100% buy-and-hold because the risk policy caps exposure at 50%.
- Its out-of-sample drawdown (46.6%) comes from winners growing far above 10% of equity and then
  retracing; the risk engine only checks exposure when buying. A production version needs a
  trim rule back to the position limit.
- Breakout looked better out-of-sample but was weak in-sample; choosing it now would be
  selection on the test period.
- Caveats: one bull-market period, a universe chosen today (survivorship bias), raw prices, and
  small trade counts. Results are optimistic; expect worse live performance.

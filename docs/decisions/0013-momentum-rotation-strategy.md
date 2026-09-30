# 0013 — Momentum rotation as the candidate universe strategy (plan-only)

Date: 2026-09-30. Status: accepted for order-free plans; execution not enabled.

Evidence: [walk-forward research](../STRATEGY_RESEARCH_2026-09-30.md) and the official engine rerun
below. The EMA-cross strategy lost money on the universe; momentum rotation was consistent across
the in-sample and out-of-sample windows.

Rules (`domain/strategy/momentum.ts`, `momentum-rotation` v1), evaluated at a session close:
- Eligible: close above its 120-session simple moving average and positive 120-session return.
- Rank eligible symbols by 120-session return. On the first session of each ISO week, buy the top
  five not already held (9% of equity each, capped by cash) and sell holdings ranked 10th or lower
  or no longer eligible. Every day, sell holdings closing at or below the moving average, and trim
  any holding above 15% of equity back to 9%.
- The plan applies the unchanged risk engine sequentially; SELLs (including trims) come first.
- Order provenance still accepts only `ema-cross`, so momentum signals cannot become orders until
  a separate, owner-approved change.

Official backtest (`runBacktest(..., 'momentum-rotation')`, 51 symbols after corporate-action
exclusion, 2023-08 … 2026-09, same costs): total +139.6%, max drawdown 26.9%, 61 completed trades,
win rate 57%; 2024-08-23 … 2025-09-30 +34.3% (MDD 9.7%); 2025-10-01 … 2026-09-29 +31.2% (MDD 26.9%).
EMA-cross on the same data: +6.6% total (−2.3% / +3.8% in the two windows).

Caveats: one bull-market regime, today's universe (survivorship), raw prices, small samples.

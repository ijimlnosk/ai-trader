# Small-account momentum research — 2026-10-06

Research only; nothing here trades. Script: `research/small-account.mjs`. Owner plans live trading with about
KRW 500,000; the paper account holds about KRW 10,000,000.

## Method

Same data and windows as the [intraday study](INTRADAY_THRESHOLDS_RESEARCH_2026-10-06.md) (51 symbols, in-sample
2024-08-23 … 2025-09-30, out-of-sample 2025-10-01 … 2026-09-29), production momentum rules (lookback and trend MA
120, daily, keep top 10, trim at 5/3 of the weight), whole shares only, same costs. Variants: positions × weight
5 × 9% (current), 3 × 30%, 2 × 45%, 1 × 95%; "top" buys only the top ranks, "fill" walks down the top 10 past
symbols one share of which does not fit. Starting capital KRW 0.5M … 10M.

## Results (return / max drawdown, share of time invested)

| Capital | Rule | In-sample | Out-of-sample |
| --- | --- | --- | --- |
| 0.5M | 5 × 9% (current) | 17.8% / 6.0%, invested 16% | −0.8% / 0.9%, invested 0% |
| 0.5M | 3 × 30% | 36.7% / 19.8%, 56% | 7.8% / 8.5%, 8% |
| 0.5M | 2 × 45% | 103.3% / 21.1%, 80% | 13.7% / 12.1%, 13% |
| 0.5M | 1 × 95% | −5.8% / 33.0%, 81% | 253.4% / 57.1%, 94% |
| 0.5M | 3 × 30%, fill | 49.1% / 23.5% | 0.8% / 20.5% |
| 2M | 3 × 30% | 74.3% / 15.7%, 81% | 161.6% / 48.1%, 76% |
| 3M | 3 × 30% | 79.6% / 16.8%, 86% | 192.0% / 52.0%, 83% |
| 10M | 5 × 9% (current) | 37.5% / 9.7%, 48% | 22.8% / 26.3%, 41% |

- At KRW 0.5M the current rule almost never holds anything out of sample: the momentum leaders cost more than
  KRW 45,000 a share. Larger weights help only partly (still idle most of the out-of-sample year).
- Buying the cheaper names further down the ranking ("fill") did not help: 0.8% and −23.8% out of sample.
- A single position (1 × 95%) swings from −6% to +253% with a 57% drawdown: a bet on one stock, not a strategy.
- From about KRW 2–3M, 3 × 30% stays invested and was the best in-sample rule; its out-of-sample year (+160–190%)
  came from a strong rally in a few leaders and carries a ~50% drawdown.
- Weights above 10% of equity are rejected by the current Risk Engine (`maxPositionExposureRate` 0.10); any such
  rule needs an explicit owner decision to change the risk policy.

## Recommendation

Do not run the current stock momentum with KRW 500,000. Next candidate: the same momentum rotation over a
universe of liquid KRX ETFs (sector, index, bond), whose prices fit small budgets and which spread risk inside
each holding. Alternatively, start live with about KRW 2–3M and 3 positions, after an owner decision on the
per-position limit.

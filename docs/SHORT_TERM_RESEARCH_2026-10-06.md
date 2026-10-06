# Short-term strategies for a KRW 500,000 account — 2026-10-06

Research only; nothing here trades. Scripts: `research/universe-scan.mjs`, `research/fetch-history.mjs`,
`research/short-term.mjs`. Evidence: `/home/jinsol/ai-trader-backups/research-lowprice-20261006`.

## Universe

- DART corp list → 3,890 listed common stocks (SPACs and preferred shares removed). One KIS daily-chart call each
  (2026-09-01 … 10-02): 3,888 answered, 2 failed; 2,442 traded every day through 10-02.
- Price KRW 1,000–45,000: 2,094. Top 100 by 20-session average turnover (100th: KRW 14.3bn/day).
- 3-year raw daily bars (2023-08-01 … 2026-10-02, 768 sessions, SHA-256 prefix `3989a710ab5e8361`): 82 aligned;
  16 more excluded for moves beyond ±30% (corporate actions) → 66 symbols.
- **Selection bias:** the universe was chosen by turnover in September 2026, i.e. stocks that are popular now.
  The out-of-sample year overlaps the period that made them popular, so its results are biased upward.

## Method

KRW 500,000, whole shares, sizing 5 × 10%, 3 × 30%, 2 × 45%. Commission 2 bp per side, sell tax 20 bp, slippage
10 bp (and 20 bp) per fill. Decisions at the close, fills at the next open; the day-trade proxy buys at the open and
sells at the same close. In-sample 2024-06-13 … 2025-09-30, out-of-sample 2025-10-01 … 2026-10-02.

- RSI(2) dip buying above the 120/200-day average, exit above the 5-day average or after 3/5 days (24 configurations).
- 20-day closing high with volume ≥ 2–3× the 20-day average, hold 1/3/5 days (18).
- Day trade after a ±5%/±10% day, with or without a volume surge (24).

## Results (median return over configurations, slippage 10 bp)

| Family | Low-price 66: in-sample | out-of-sample | Large caps 51: in-sample | out-of-sample |
| --- | --- | --- | --- | --- |
| RSI(2) dip buying | 4.0% | −13.4% | −3.1% | −0.5% |
| Volume breakout | −30.3% | +171.0% | −1.6% | −11.0% |
| Day trade proxy | −26.3% | −23.9% | 0.0% | −6.6% |

Equal-weight buy and hold of the 66 low-price names: +26.4% in-sample, +124.2% out-of-sample.

- Day trading lost in every window and universe: costs (about 0.3–0.5% per round trip) exceed the moves it captures.
- RSI(2): the in-sample best (2 × 45%) returned +4.7% out of sample with a 34% drawdown, −2.9% at 20 bp slippage.
- Breakout lost 30% in-sample and gained 171% out of sample, the year in which these stocks became popular. This
  is the selection bias above, not evidence of an edge.

## Conclusion

No short-term rule shows a reliable edge after costs at KRW 500,000; day trading is clearly negative. A fair test
of breakout needs a point-in-time universe (each month, pick low-price liquid stocks using only data known then),
which needs 3-year history for about 2,000 stocks (about 16,000 KIS calls, roughly 7 hours overnight).

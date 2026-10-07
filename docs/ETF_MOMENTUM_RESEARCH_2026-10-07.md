# ETF momentum for a KRW 500,000 account — 2026-10-07

Research only; nothing here trades. Script: `research/etf-momentum.mjs`. Evidence:
`/home/jinsol/ai-trader-backups/research-etf-pit-20261007/etf.json` (SHA-256 prefix `2a357a0cab0c5a08`; the first
16:42 run was cut at 64 KiB by a `process.exit` in the fetch script and was re-run after the fix).

## Data and method

- 62 KRX ETFs chosen on 2026-10-07 from the public ETF list: no leverage, inverse, covered-call, active, money-market
  or short-bond products; price KRW 3,000–100,000 (plus TIGER 국채3년, KODEX 은선물); traded value ≥ KRW 1bn that
  day; one fund per tracked theme. Raw KIS daily bars 2023-08-01 … 2026-10-06; each ETF joins when it has enough
  history (56 were listed before 2024-04).
- KRW 500,000, whole shares, 1–3 ETFs with equal budgets, decisions at the close, fills at the next open.
  Commission 2 bp per side, slippage 5 bp, no sell tax (simplification for ETFs).
- Grid: lookback 20/60/120 sessions, trend filter none/60/120-day average, 1/2/3 ETFs, daily or weekly rebalancing
  (54 configurations). In-sample 2024-06-13 … 2025-09-30, out-of-sample 2025-10-01 … 2026-10-06.
- Selection bias: the list reflects today's popular themes (AI, semiconductors, power equipment).

## Results (return / max drawdown)

| Rule | In-sample | Out-of-sample |
| --- | --- | --- |
| 20 days, no filter, 3 ETFs, weekly (in-sample best) | 44.2% / 17.0% | 28.6% / 33.0% |
| 20 days, above 120-day average, 3 ETFs, weekly | 35.7% / 15.2% | 37.1% / 29.5% |
| 20 days, no filter, 2 ETFs, weekly | 50.1% / 21.5% | 58.9% / 37.4% |
| 120 days, above 60-day average, 3 ETFs, daily | 36.9% / 20.1% | 154.7% / 47.4% |
| 60 days, above 60-day average, 1 ETF, weekly | 48.4% / 28.6% | −43.8% / 53.9% |
| Hold RISE 200TR (KOSPI 200) | 29.9% | 133.9% |
| Hold TIGER 미국S&P500 | 25.2% | 11.6% |

Out-of-sample median over all 54 configurations: +44.4%; 81% of them were positive.

- Unlike the stock momentum, ETF momentum stays invested at KRW 500,000 (prices fit the budget).
- In the selection window the best rules beat holding KOSPI 200 (+44% vs +30%) with a 17% drawdown.
- In the test year none of the in-sample leaders beat simply holding KOSPI 200 (+134%, an exceptional rally), and
  drawdowns reached 30–50%: the leaders rotate between concentrated sector ETFs.
- A single ETF was the worst (−44% out of sample).

## Conclusion

ETF momentum is executable at KRW 500,000 and was positive in most configurations, but it did not beat holding the
index in the test year. Candidate for a virtual run next to the day-trading one: 20-session lookback, 3 ETFs, weekly,
with the 120-day trend filter (the most stable pair of windows above).

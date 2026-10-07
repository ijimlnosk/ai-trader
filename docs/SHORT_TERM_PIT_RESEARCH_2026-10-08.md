# Short-term strategies on a point-in-time low-price universe — 2026-10-08

Research only; nothing here trades. Script: `research/short-term-pit.mjs`. Follows
[the 2026-10-06 study](SHORT_TERM_RESEARCH_2026-10-06.md), whose universe was chosen with today's turnover.

## Data and method

- Raw KIS daily bars 2023-08-01 … 2026-10-06 for 2,649 listed common stocks (every stock that traded through
  2026-10-02 in the 10-06 scan); SHA-256 prefix `49eeec685b926f01`, evidence
  `/home/jinsol/ai-trader-backups/research-etf-pit-20261007/pit.json`. Fetched 19:00–03:55 KST, 0 errors.
- Point-in-time universe, rebuilt each month from bars before its first session: last close KRW 1,000–45,000, at least
  60 bars, traded on each of the last 20 sessions, top 100 by 20-session average traded value.
- Same rules, sizing and costs as the 10-06 study (KRW 500,000; 5 × 10%, 3 × 30%, 2 × 45%; commission 2 bp per side,
  sell tax 20 bp, slippage 10 and 20 bp). A holding that gaps beyond ±30% (corporate action) is closed at the previous
  close without costs. Delisted stocks are missing (survivorship bias in favor of the strategies).

## Results (median over configurations, slippage 10 bp)

| Family | In-sample 2024-06-13 … 2025-09-30 | Out-of-sample 2025-10-01 … 2026-10-06 | Positive out-of-sample |
| --- | --- | --- | --- |
| RSI(2) dip buying | −21.7% | −2.1% | 33% |
| Volume breakout | −38.4% | −43.0% | 11% |
| Day trade after a ±5/10% day | −43.9% | −45.1% | 0% |

Equal-weight monthly hold of the same universe: −20.2% in-sample, +12.6% out-of-sample (no costs).

- With the universe chosen only from information available at the time, breakout lost in both windows: the +171%
  of the 10-06 study came from picking today's winners.
- The day-trade proxy lost in every configuration, at both slippage levels.
- The in-sample best RSI(2) rule returned +3.4% out of sample with a 30% drawdown, −6.9% for the best at 20 bp.

## Conclusion

No daily-bar short-term rule tested here has an edge on liquid low-price stocks after costs. The virtual day trading
(`day-v1`, decision 0020) buys morning strength in the same kind of stocks; its live virtual record and the minute bars
will show whether intraday exits change this. Results from these daily proxies suggest they will not.

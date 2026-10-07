# 0021 — Virtual weekly ETF rotation for a KRW 500,000 account

Date: 2026-10-07. Status: accepted (owner request). Order-free; runs next to the virtual day trading (decision 0020).

- Rule `etf-v1` (`domain/strategy/etfRotation.ts`), from docs/ETF_MOMENTUM_RESEARCH_2026-10-07.md: on the first session
  of each week, rank the 62-ETF universe (`krx-etf-2026-10-v1`) by 20-session return among ETFs above their 120-day
  average, using completed daily bars through the previous session; hold the top 3 with equal budgets, keep holdings
  while they rank in the top 6.
- Between 09:20 and 14:00 KST: daily history for each ETF (about 2 KIS calls each) and quotes for the trades, through the
  shared production KIS gate. Virtual fills at live quotes with commission 2 bp and slippage 10 bp; no transaction tax
  on ETF sales. Fills go to `shadow_trades` under `etf-v1`; a session with fills is never repeated.
- `SHADOW_ETF_ROTATION_ENABLED` (default false). The console shows each virtual ledger with its seed and the realized
  profit beyond it (owner plans to keep the seed and spend part of the profit).

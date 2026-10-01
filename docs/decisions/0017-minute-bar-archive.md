# 0017 — Archive minute bars for intraday research

Date: 2026-10-01. Status: accepted (owner request). Data only; no strategy or order uses it.

The owner wants to evaluate intraday trading. There is no intraday history to backtest against, so
minute bars are archived from now on before any intraday rule is considered.

- Source: KIS `FHKST03010200` (today's minute bars, 30 per call, newest first; works on the paper
  domain). The provider serves only the current day, so collection runs the same evening.
- Schedule: `MINUTE_BARS_SCHEDULE_ENABLED` (default false). On reviewed sessions from 15:40 to 23:00
  KST, every universe symbol is paged back from 15:30 to 09:00 (about 14 calls per symbol, about 750
  calls per session through the existing 1.5 s request pacing). Failed symbols are retried up to
  three times, 10 minutes apart. Runs on its own timer, after momentum execution has ended.
- Storage: `market_minute_bars` (migration 0011), one insert-only row per symbol and session, with
  raw KRW prices, share volumes, the provider's HHMMSS labels in Asia/Seoul, provenance and a digest
  of the raw pages. Pages from another day, duplicate or out-of-range times and inconsistent OHLC
  are rejected or skipped, never padded or repaired.

Any intraday strategy will need its own decision with a cost-inclusive backtest on this archive.

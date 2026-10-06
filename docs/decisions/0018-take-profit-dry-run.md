# 0018 — Take-profit dry run during the session

Date: 2026-10-06. Status: accepted (owner request to proceed with the intraday plan). Order-free.

The daily-bar proxy study ([research](../INTRADAY_THRESHOLDS_RESEARCH_2026-10-06.md)) selected a candidate:
sell a momentum holding in full once it is 30% above its entry, then block re-entry for 5 sessions.
Before any order depends on it, the rule is observed live without trading.

- `INTRADAY_TAKE_PROFIT_DRY_RUN_ENABLED` (default false). On reviewed sessions from 09:05 to 15:20 KST,
  every 60 seconds, the watch reads the paper portfolio and a quote for each held position.
- A quote counts only if it is for the same symbol and at most 10 seconds old (the execution rule). The
  gain is measured against the broker's average purchase price in exact decimals, floored to basis points.
- The first crossing of at least 3000 bp per symbol and session is stored in `intraday_signals`
  (migration 0012, insert-only, unique per symbol/session/rule) and logged as `take_profit_dry_run`.
- It creates no proposal or order, and does not apply the re-entry block. Failed or stale reads are skipped
  and retried on the next step. About one KIS quote call per held position per minute (at most 5).

Enabling real take-profit orders, and the momentum re-entry block, need the minute-bar confirmation and a
separate decision.

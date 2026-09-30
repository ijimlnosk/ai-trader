# 0014 — Execute the momentum plan with paper orders

Date: 2026-09-30. Status: accepted (owner request: paper orders now; live trading not in scope).

The daily `plan-momentum-*` run is executed on paper by `createMomentumExecutor`, driven by the daily
schedule every 30 seconds within 09:05–15:00 KST on reviewed sessions:

- Only risk-approved plan items, in plan order (SELLs incl. trims first, then BUYs by momentum).
- One order at a time: the account's single-unresolved-order rule is kept. Each item uses the
  deterministic strategy order key (strategy, version, symbol, bar), so repeated calls and
  restarts replay the stored order instead of sending another. An unsettled order gets at most one
  reconciliation per call (`pending`); `PREPARING`/`SUBMITTING`/`UNKNOWN` or an account conflict
  halt execution for the day. Failed or rejected items (e.g. buying power) are recorded and skipped.
- Every order still passes execution-time quote freshness, session window, holdings,
  broker buying power and the unchanged risk engine.
- Order provenance accepts `momentum-rotation` v1 with the plan run key, dataset digest, metrics
  and account inputs (`MomentumProvenance`).
- Switches: `PAPER_ORDER_EXECUTION_ENABLED`, `UNIVERSE_PLAN_SCHEDULE_ENABLED` and the new
  `MOMENTUM_EXECUTION_ENABLED` must all be on, and the owner's web toggle must be on. The EMA loop
  schedule cannot be enabled at the same time (one automated strategy per account). Live mode is
  unaffected and unimplemented.

Entries happen only after the first session of an ISO week (next: the 2026-10-06 close, orders on
2026-10-07); exits and trims are daily.

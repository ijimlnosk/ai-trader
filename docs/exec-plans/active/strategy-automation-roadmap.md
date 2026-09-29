# Strategy automation roadmap

## Phase status

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | MarketSnapshot + indicator engine | Complete |
| 2 | Deterministic Strategy Engine v1 | Complete |
| 3 | Offline next-open backtest engine | Complete |
| 4 | Strategy → deterministic Risk connection | Complete |
| 5 | Scheduler and trading-session coordination | Complete (2026-09-29; production save/replay/conflict verified) |
| 6 | KIS paper BUY/SELL E2E during an open session | Complete (2026-09-28; execution disabled afterward) |
| 7 | Strategy → Risk → Execution paper loop | Complete (2026-09-29; commissioned, disabled afterward) |

## Completed foundation

Phase 1 owns validated daily OHLCV, EMA20/60, Wilder RSI14/ATR14, liquidity and volume screens.
Phase 2 produces deterministic `TradeProposal` values. Phase 3 evaluates next-session-open fills
with an isolated ledger and exact monetary costs. Phase 4 rechecks proposals through the production
Risk Engine and paper account ledger before any execution path.

## Verified scheduler and session coordination

The scheduler boundary passed its deployed in-session dry run, same-key replay and changed-data
conflict on 2026-09-29. See [production evidence](../../SCHEDULER_CHECK_2026-09-29.md). It coordinates these order-free steps:

1. load an explicit, validated market dataset or daily snapshot;
2. verify the Seoul session and data freshness;
3. evaluate the strategy and risk context;
4. persist an idempotent run record and report proposals/decisions.

2026-09-28 attempt: actual KIS history ended on 9/23, about 119 hours before the check. Both
requests safely failed the 96-hour strategy freshness limit; no run or order was created.
This was resolved with independently calendar-checked completed 9/28 data on 9/29.
The freshness guard remains unchanged.
See [scheduler check](../../SCHEDULER_CHECK_2026-09-28.md).

The first implementation must not submit orders, enable paper execution, infer holidays, or invent
missing candles. It needs an injected clock, explicit session calendar, bounded retries for no
broker writes, run idempotency, and a dry-run CLI or endpoint. Execution should be added only after
Phase 6 confirms the real paper account round trip.

The first dry-run boundary is now `POST /api/v1/strategy/schedule`. It requires a caller-supplied
session date, uses an injected-clock session check, evaluates strategy and risk without an execution
symbol, and replays an idempotent run record. Production composition persists records in the
`strategy_runs` PostgreSQL table; tests use an in-memory adapter.

## Phase 6 gate

Passed 2026-09-28 at 14:24–14:25 KST. One-share BUY/SELL both filled at KRW 272,750; broker
holdings returned to one share. New reconciliation deltas, replay idempotency, moving-average
gross P/L KRW 9,375 and next risk inputs were verified. Paper execution was disabled again.
Evidence: [paper checkpoint](../../PAPER_E2E_2026-09-28.md).

Checkpoint procedure: during a permitted 09:00–15:20 Asia/Seoul session, with the account exclusive and execution opt-in
temporary: baseline one-share holdings, submit one paper BUY with a retained idempotency key,
reconcile until KIS holdings and DB agree, submit one paper SELL, reconcile again, and verify the
moving-average ledger P/L and next risk context. Disable execution after the checkpoint. Any timeout
or ambiguous result remains unresolved and must not be retried under a new key.

## Phase 7 gate

Implementation scope and recovery/validation criteria are prepared in
[Strategy paper loop v1](../completed/strategy-paper-loop-v1.md). Planning is complete; implementation and
activation remain pending. No background job has been installed.

Only after Phase 5 dry-run idempotency and Phase 6 paper BUY/SELL evidence pass may a scheduler call
the existing Strategy → Risk → Execution application path. The first loop remains paper-only,
single-symbol or explicit-universe, kill-switchable, auditable and disabled by default.

2026-09-29: Phase 5 and Phase 6 evidence gates passed. Phase 7 implementation remains pending.
Track the observed two-portfolio-read valuation mismatch before automatic-loop commissioning;
do not relax equality checks or treat retries as a fix. No automatic trading was enabled.

2026-09-29: bounded loop implementation and isolated DB tests completed; see [loop plan](../completed/strategy-paper-loop-v1.md) and [runbook](../../PAPER_LOOP.md). Activation remains separate.

2026-09-29: loop deployed disabled and commissioned with one strategy-generated paper SELL; see [commissioning](../../PAPER_LOOP_COMMISSION_2026-09-29.md). Loop and execution are off.

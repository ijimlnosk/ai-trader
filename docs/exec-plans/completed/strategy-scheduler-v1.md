# Strategy scheduler v1

## Goal

Add a paper-only scheduler boundary that evaluates strategy and risk during an explicitly declared Seoul session without submitting broker orders.

## Constraints

- The session date must be supplied by the caller; holidays are not inferred.
- The scheduler accepts validated market data and never receives an execution symbol.
- A run key is idempotent and cannot be reused with different data.
- The clock is injected for deterministic tests.

## Progress

- Added an explicit session calendar and Seoul regular-session window check.
- Added an application scheduler with an idempotent run repository port, in-memory test implementation, and PostgreSQL implementation.
- Added the `strategy_runs` table and Drizzle migration; production composition now uses the durable repository.
- Added a bearer-protected dry-run endpoint at `POST /api/v1/strategy/schedule`.
- Added session and idempotency tests.

## Validation

- Server TypeScript compilation passes.
- 2026-09-23: deployed to `jinsol@sol-server:~/ai-trader-app`; Compose build, migration, and server recreation succeeded.
- Production health returned 200 with `database=connected` and `tradingMode=paper`.
- Runtime flags remained `BROKER_MODE=paper`, `LIVE_TRADING_ENABLED=false`, and `PAPER_ORDER_EXECUTION_ENABLED=false`.
- Authenticated scheduler request outside the declared Seoul session failed closed with `order_context_unavailable`; no order was submitted.
- PostgreSQL reported `strategy_runs` present with zero records after the rejected request.
- 2026-09-23 preflight: health, portfolio, and KIS paper broker status returned 200; portfolio remained one available `005930` share.
- Before/after counts remained orders=1, executions=1, fills=1, strategy_runs=0.
- 2026-09-28 14:46 KST: fetched and archived 100 actual KIS raw daily bars for 005930;
  latest completed bar was 20260923, approximately 119.27 hours old (96-hour maximum).
  Two identical authenticated in-session scheduler requests returned 503
  `order_context_unavailable`; counts remained orders=3, executions=3, fills=3, strategy_runs=0.
  Paper execution/live stayed disabled. No persisted run exists to prove production replay yet.
  Focused scheduler/strategy tests: 8 passed using installed Vitest (pnpm absent from PATH).
  Detailed evidence and data-completeness limits: docs/SCHEDULER_CHECK_2026-09-28.md.

## Completion — 2026-09-29

Production verification passed at 11:07 KST with revised completed 9/28 data, independently
calendar-checked across all 100 bars. First request 200, complete parsed replay equal, changed-data
409, one persisted run with expected hash, and orders/executions/fills unchanged at 3 each with
identical full-row hashes. `order` remained null. Paper execution and live stayed disabled.

See [production evidence](../../SCHEDULER_CHECK_2026-09-29.md). An earlier 503 was followed by a
read-only diagnosis demonstrating different equity values across the strategy's two portfolio
reads. A bounded same-key retry passed without code/configuration changes. That intermittent
availability issue remains a follow-up before automatic-loop commissioning, not a fixed defect.

No source changed since the 9/28 gates: lint/typecheck/build passed, 410 tests passed and 10
explicit disposable-DB tests skipped. Today's production check supplies the missing persistence,
replay and conflict evidence. No automatic job or execution wiring was added.

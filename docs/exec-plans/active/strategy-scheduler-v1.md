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

## Remaining

- Keep Phase 6 KIS BUY/SELL verification separate; this endpoint must remain order-free.

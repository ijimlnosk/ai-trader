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
- Added an application scheduler with an idempotent run repository port and in-memory implementation.
- Added a bearer-protected dry-run endpoint at `POST /api/v1/strategy/schedule`.
- Added session and idempotency tests.

## Validation

- Server TypeScript compilation passes.

## Remaining

- Replace the in-memory repository with a durable audit store before unattended scheduling.
- Keep Phase 6 KIS BUY/SELL verification separate; this endpoint must remain order-free.

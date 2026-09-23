# Frontend read-only console

## Current state

There is no `apps/web` package yet. The server and shared contracts are the current product surface.
The first frontend should be a paper-mode operator console; it must not contain broker credentials or
call an order API directly.

## Recommended scope

1. **Safety banner** — health, database connectivity, broker provider, paper/live mode, execution flag,
   and kill-switch state. Live mode must be visually impossible to confuse with paper mode.
2. **Portfolio view** — cash, total evaluation, positions, available quantity, average price, and
   unrealized P/L from `GET /api/v1/portfolio`.
3. **Market view** — read-only quotes with receipt time and stale-data state.
4. **Strategy dry-run view** — upload/select a validated dataset, provide an explicit session date and
   run key, call `POST /api/v1/strategy/schedule`, and show each proposal, risk decision, and reason.
   The form must not expose an execution-symbol or order-submit action.
5. **Run audit view** — add a protected server read endpoint for persisted `strategy_runs`, then show
   run key, session date, data hash, created time, and replay status.
6. **Order and ledger history** — read-only order status, fills, executions, and positions-synced state.

## Deferred

- No BUY/SELL button before Phase 7 and explicit paper-only execution UX review.
- No AI prompt or broker credential controls in browser code.
- No automatic polling loop until server-side session scheduling is proven.

## Proposed implementation order

1. Add shared response schemas/types for strategy runs and audit summaries.
2. Add `GET /api/v1/strategy/runs` with account-scoped pagination and no raw dataset payload.
3. Scaffold `apps/web` with TanStack Query and a paper-mode shell.
4. Build safety banner, portfolio, and run audit panels.
5. Add the dry-run dataset workflow and integration tests.

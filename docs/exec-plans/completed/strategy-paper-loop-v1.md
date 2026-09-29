# Goal

Connect a bounded, single-symbol paper loop to the existing deterministic Strategy → Risk →
Execution → Broker path, with durable run identity, recoverable order linkage and default-off
operation. Implementation and local validation are complete; deployment/commissioning progress is recorded below.

# Constraints

- Phase 5 production success/replay/conflict evidence must pass before connecting a scheduler to
  execution. Phase 6 passed on 2026-09-28; see [paper checkpoint](../../PAPER_E2E_2026-09-28.md).
- Paper only, initially `005930`, one configured account with exclusive use. No AI, live mode,
  strategy tuning, new risk thresholds, UI, arbitrary symbol universe or broker order retries.
- Keep `POST /api/v1/strategy/schedule` order-free and preserve existing API behavior.
- Preserve 96-hour completed-bar freshness, next-calendar-weekday submission eligibility,
  09:00–15:20 Seoul order window and the execution-time quote/session checks. Holiday-aware
  eligibility is separate work; unsupported holidays/special sessions skip rather than bypass.
- Do not turn on execution as part of a tick. Proposed loop opt-in defaults false and is separate
  from `PAPER_ORDER_EXECUTION_ENABLED`; both must be true for loop submissions.
- `TRADING_KILL_SWITCH_ENABLED` retains its existing BUY halt / valid SELL semantics. Disabling
  paper execution stops all new submissions; reconciliation remains usable and does not cancel
  already accepted orders.
- Strategy sizing remains unchanged. The Phase 6 one-share test is not permission to truncate a
  future strategy proposal to one share or to force a signal. HOLD and risk rejection are valid.

# Current State

- `application/strategy/index.ts` already accepts an explicit execution symbol. It evaluates the
  strategy, calls deterministic risk, and delegates an approved proposal to `OrderServices.submit`.
  Submission rechecks quote, holdings, buying power, risk and session; reuse this path.
- The existing strategy order key binds strategy ID/version, symbol and completed bar. Account
  order reservation, unique unresolved-order constraint and reconciliation own financial state.
- `application/scheduler/index.ts` persists an evaluation only after the strategy returns. It does
  not claim work before evaluation. Its replay currently checks data digest, not session-date
  equality. Neither behavior proves safe concurrent execution scheduling; do not merely add an
  execution symbol to that service.
- Re-evaluating after a fill can produce HOLD or a different portfolio-derived result. Recover
  existing work through its stored order identity instead of recalculating a new trade.
- No production daily-history pipeline, authoritative calendar integration, background worker or
  cross-process KIS pacing exists. Current KIS pacing is shared within one server process only.
- Phase 5 attempt on 9/28 rejected 9/23 data as older than 96 hours; subsequent 9/29 save/replay/conflict verification passed. See [scheduler check](../../SCHEDULER_CHECK_2026-09-28.md).

# Plan

- [x] Inspect existing scheduler, strategy, execution, persistence and operating constraints.
- [x] Define the smallest implementation scope, recovery behavior and acceptance gates.
- [x] Close Phase 5: independently validate the expected session calendar; archive fresh actual
  completed OHLCV; prove one persisted dry run, identical replay and changed-data 409, with
  unchanged orders/executions/fills and execution disabled.
- [x] Add bounded paper-loop application orchestration and a durable run repository. Reuse the
  existing strategy service and order services; do not duplicate strategy/risk/broker logic.
- [x] Add an additive migration and account-scoped recovery lookup by the retained strategy order
  key, with tests for conflicting inputs, concurrent claims and crash boundaries.
- [x] Expose one authenticated manual tick for commissioning, separate from the existing dry-run
  endpoint. Validate explicit session, one configured symbol and archived dataset reference/digest.
- [x] After manual tick/recovery tests pass, add a single-process, non-overlapping trigger using
  that same use case. Start with an operator-supplied validated dataset and declared session;
  no ingestion daemon, holiday guessing or automatic credential/configuration changes.
- [x] Complete relevant unit/API/disposable-DB checks and repository gates; document the actual
  implemented architecture and persistence/recovery decision before deployment.
- [x] Deploy disabled, verify dry-run parity and restart with loop/execution off. See
  [disabled deployment](../../PAPER_LOOP_DEPLOY_2026-09-29.md).
- [x] Conduct a separate bounded paper commissioning session with explicit operating scope.
  Preserve evidence and disable again. See [commissioning](../../PAPER_LOOP_COMMISSION_2026-09-29.md).

# Decisions (proposed implementation)

## Run identity and persistence

Use a separate durable paper-loop run record so stored dry runs cannot implicitly become trades.
Prefer one additive table over modifying historical order/fill records. Before calling a service
that can submit, atomically claim the account + strategy/version + symbol + completed-bar identity.
Retain the session date, normalized input digest, archived data reference, execution mode, strategy
order key, status, timestamps and eventual local order ID. A changed digest/session/mode for the
same identity conflicts; another caller's run key must not authorize a second trade for that bar.

Claim losers return stored state without evaluating or submitting. Do not hold a DB transaction
across broker calls. The existing account-scoped order reservation remains the final financial
guard; the loop record coordinates work rather than replacing that reservation or its audit.

Persist the deterministic order key before the execution-capable call. On a crash after reservation
or broker acceptance but before linking the local order ID, look up the existing order by that key
within the same account. A stale claimed run with no identifiable order remains halted for review;
do not expire its claim and assume no order was sent. Final schema/status names belong in the
implementation migration and tests, not a second independent broker-order state machine.

## One tick

1. Validate paper mode, default-off opt-ins, explicit session, symbol, complete raw daily dataset,
   independent expected calendar, freshness and supported next-weekday eligibility.
2. Recover an existing run/order first. An unresolved account order blocks new trade evaluation.
   Known broker IDs may use bounded reconciliation; missing IDs and PREPARING/ambiguous states
   remain halted according to the existing runbook.
3. Claim new work durably, then call the existing strategy service with the single allowed symbol.
   Save HOLD, no proposal, risk rejection or failure as a terminal no-new-order result for that bar.
4. Link an accepted order and use existing reconciliation until filled/synchronized or the bounded
   deadline expires. An expired deadline means pending/manual follow-up, never a new order key.
5. Persist the outcome, input digest, risk/order references and safe reason codes. Replays return
   that record; a completed tick does not repeatedly re-evaluate the same bar after portfolio changes.

The first trigger runs in the existing server process and shares its KIS client/pacing. No overlapping
ticks, unbounded catch-up, automatic order cancellation or autonomous UNKNOWN recovery. Read-only
reconciliation retries are bounded and paced; order transport is never automatically retried.

# Affected Areas

| Owner | Intended change |
| --- | --- |
| `apps/server/src/application/` | Paper-loop use case and small run-repository port; reuse strategy/orders |
| `apps/server/src/infrastructure/database/` and `apps/server/drizzle/` | Additive run persistence, atomic claim, scoped order-key recovery |
| `apps/server/src/interfaces/http/` | Authenticated tick request validation and response mapping |
| `apps/server/src/app/` | Default-off configuration, composition and bounded same-process trigger lifecycle |
| `packages/contracts/` | Only externally shared loop request/status contracts if the HTTP interface needs them |
| `docs/ARCHITECTURE.md`, `docs/decisions/`, runbooks | Actual implemented boundaries, failure semantics and commissioning procedure |

# Validation

Planning review only: inspected production-path ownership and existing tests; no source or runtime
change in this task. Documentation whitespace/link checks apply. Earlier Phase 5 focused tests
passed 8/8; they are not proof of the proposed loop.

Implementation acceptance must include:

- Default disabled, one opt-in missing, unauthorized caller, wrong symbol, closed/undeclared
  session, stale/future/incomplete bars and risk denial all produce zero broker submissions.
- An eligible approved fixture follows the existing execution service exactly once and persists
  provenance; a fixture may exercise a signal but must never be presented as real market evidence.
- Same run/bar, changed input, concurrent callers and process restart cannot create duplicate
  orders. Dry-run records remain isolated from execution identity.
- Inject crashes before/after claim, order reservation, broker acknowledgement and run linkage.
  Prove lookup/reconciliation or a durable halt, never inferred non-submission or a new retry key.
- UNKNOWN, missing broker ID, partial fills, delayed holdings and DB failures preserve blockers;
  repeated reconciliation cannot duplicate execution deltas or overwrite later holdings.
- Verify stable run replay after holdings change, BUY kill switch, all-submission opt-out, and
  operator access to reconciliation after stopping the loop.
- Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`; use an explicit empty disposable
  database for persistence tests. Resolve pnpm availability first; never target the operational DB
  or submit real broker orders from automated tests.

# Rollback and Stop Conditions

Disable the loop trigger and paper submissions, applying configuration using the existing service
recreation procedure. Preserve run/order/fill/execution history and additive schema. Reconcile any
known pending order; ambiguous state stays blocked. Do not automatically restore older binaries
over pending work or delete run identities to unlock a retry.

Stop implementation expansion after the bounded single-symbol loop, recovery tests and documented
commissioning evidence pass. Multi-symbol scheduling, market-data ingestion, holiday-aware calendar
policy, AI and live trading need separate scope. A natural HOLD proves an operating tick, not an
actual strategy-generated fill; report those forms of evidence separately.

# Progress

2026-09-28: planning complete. No loop code, migration, trigger, automatic job or execution opt-in
was added. Phase 5's next-session production evidence is still the prerequisite to execution wiring.

# Remaining Work

2026-09-28 after close: Phase 5 data/request preparation is recorded in
[scheduler preparation](../../SCHEDULER_PREP_2026-09-28.md). Latest KIS bar is now 9/28 and all
100 dates match the independently constructed calendar. Production run/replay/conflict proof
remains pending; this does not clear the execution-wiring gate.

Phase 5 passed on 2026-09-29; implement and validate the unchecked steps above. This plan does not schedule
a future run, authorize live trading or assert that an automatic paper loop is already running.

2026-09-29: [Phase 5 evidence](../../SCHEDULER_CHECK_2026-09-29.md) passed with one saved run,
identical replay, changed-data 409 and unchanged order ledgers. Earlier pending statements above
are historical. Before loop commissioning, address the diagnosed two-read portfolio valuation
race with coherent account/risk input and regression proof; retain fail-closed behavior.
No loop implementation or execution opt-in was added.


2026-09-29 implementation: added account-scoped atomic claims, full input/digest/calendar provenance,
order-key recovery, optimistic updates, authenticated tick and default-off same-process fixed-task
trigger. Coherent portfolio/risk snapshot resolves the observed two-read valuation race. Order
execution still performs fresh account/quote/risk checks. No AI/live/order retries or sizing changes.

Validation: unit/API/trigger/strategy cases pass; isolated PostgreSQL 17 migration/order/loop tests
13/13 passed through a loopback SSH tunnel. No operational DB was targeted by tests. Repository
test gate: 439 passed, 13 DB cases skipped there but executed separately. Lint/typecheck passed;
build verification and disabled deployment are recorded in the follow-up below.

Decision refinement: one reconciliation call per tick, 120-second deadline, 30-second fixed-task
trigger. Exceptions conservatively retain HALTED/CLAIMED instead of assuming no submission.
A claim without an order has no automatic expiry/unlock. Existing-order recovery works after opt-out.
Calendar references are explicit operator provenance; no automatic calendar certification is claimed.
See docs/PAPER_LOOP.md and decision 0008 for actual behavior and rollback constraints.

2026-09-29 follow-up: repository gates rerun locally with pnpm 10.17.1 (via npx; pnpm not on PATH).
`pnpm lint`, `pnpm typecheck` and `pnpm build` passed; `pnpm test` 439 passed, 13 DB cases skipped
(covered by the isolated PostgreSQL run above). Disabled deployment (12:01 KST) and a forced
restart (12:30 KST) then passed on sol-server: 401/`loop_disabled` 503, identical Phase 5 replay,
unchanged ledgers and 0 loop rows. Commissioning has not been performed.

2026-09-29 commissioning: one manual tick at 12:41 KST (switches on 12:40–12:43 only) produced a
strategy-generated SELL 1 `005930`, risk-approved, KIS order 23139 filled at KRW 272,500 and run
`COMPLETE`. Ledger daily realized P/L 9125, streak 0, KIS and ledger both flat. Disabled replay
returned the stored record with no new rows. TRACKING/trigger/crash paths were not exercised live.
All plan steps are complete; plan moved to `completed/`.

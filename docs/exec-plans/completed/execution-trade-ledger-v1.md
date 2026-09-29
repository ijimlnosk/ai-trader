# Goal
Connect KIS reconciliation to a durable execution ledger and real daily realized P/L/loss streak risk inputs.
# Constraints
Paper only; deterministic risk mandatory; no broker POST retries; no fabricated basis or historical P/L.
# Current State
Implemented in commit 2411e64. Explicit reconciliation atomically persists cumulative fills,
execution deltas and the position mirror. Production risk reads ledger-backed realized P/L and
loss streak, rejecting incomplete history or holdings mismatches. Local verification passed;
deployment, historical KIS fill/holdings and preserved ledger checks passed on 2026-09-21.
New paper BUY/SELL reconciliation and realized-P/L observations passed on 2026-09-28.
# Plan
- [x] Exact ledger projection and execution delta invariants
- [x] Additive executions migration, historical cumulative fill backfill and atomic persistence
- [x] Ledger-backed production risk and account holdings coverage validation
- [x] Partial/unfilled/UNKNOWN regression tests, database rollback/idempotency proof
- [x] Documentation and repository checks
# Decisions
Executions are observed cumulative deltas, not fabricated exchange execution IDs or timestamps.
Use moving-average cost, 8-decimal fixed precision with residual cost retained until final disposal.
Gross realized P/L excludes unavailable fee/tax data. Seoul order date is the KRX cash execution day.
Loss streak counts net losing SELL orders (partial fills aggregated), persists across days; nonloss resets.
Untracked holdings or missing historical BUY basis fail closed. No automatic opening-balance estimate.
Reuse explicit reconciliation API; no new timer, order retry, strategy or AI path.
# Progress
Inspected rules, active plans, application/repository/adapter and tests. Worktree initially clean.
Checked official KIS inquire_daily_ccld sample for cumulative fields and continuation protocol.
# Validation
2026-09-21: pnpm lint, pnpm typecheck and pnpm build passed on source commit 1ecd5e7.
pnpm test with isolated PostgreSQL 17.6: 414 tests passed, none skipped, including all 10 database
tests. Compiled migrations applied successfully twice on a separate fresh disposable database.
No broker order was sent during the 2026-09-21 local checks.
2026-09-28: new paper BUY and SELL both filled one share at KRW 272,750. Reconciliation persisted
one delta per order; replay left three total executions. Broker holdings returned to one share;
ledger and next-risk context agreed on KRW 9,375 gross daily realized P/L and zero consecutive
losses. Execution was disabled again. See docs/PAPER_E2E_2026-09-28.md.
# Remaining Work
None for this implementation and normal full-fill operational checkpoint. Completed paper E2E
plan: docs/exec-plans/completed/paper-e2e-verification.md. Adverse broker states remain covered
by deterministic tests rather than newly forced broker outcomes.

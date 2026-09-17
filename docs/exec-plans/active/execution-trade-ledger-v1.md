# Goal
Connect KIS reconciliation to a durable execution ledger and real daily realized P/L/loss streak risk inputs.
# Constraints
Paper only; deterministic risk mandatory; no broker POST retries; no fabricated basis or historical P/L.
# Current State
Existing explicit reconcile reads cumulative KIS fills and atomically updates orders/position mirror.
Risk still uses zero loss history. Kill switch exists in execution configuration.
# Plan
- [ ] Exact ledger projection and execution delta invariants
- [ ] Additive executions migration, historical cumulative fill backfill and atomic persistence
- [ ] Ledger-backed production risk and account holdings coverage validation
- [ ] Partial/unfilled/UNKNOWN regression tests, database rollback/idempotency proof
- [ ] Documentation and repository checks
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
Pending.
# Remaining Work
Implementation and validation; actual deployment/migration and broker reconciliation require environment access.

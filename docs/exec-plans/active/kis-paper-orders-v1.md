# Goal
Human-submitted paper MARKET proposals pass server-priced deterministic risk, submit once to KIS,
persist order/audit state, support lookup and explicit fill reconciliation, and mirror broker positions.
# Constraints
Paper only, no AI/strategy/live orders. Preserve existing data and current diagnostic behavior.
Never retry an ambiguous order POST. No credentials/account numbers in DB audit or logs.
# Plan
- [x] Contracts, durable state machine, application execution and reconciliation
- [x] KIS paper order/buying-power/fill adapters using current official samples
- [x] Additive Drizzle migration and repository with idempotency/account serialization
- [x] Protected HTTP endpoints, production wiring and operational documentation
- [x] Unit/inject/adapter/database checks and typecheck/lint/test/build
- [ ] Deployment and authorized single Samsung share verification if environment is available
# Decisions
Persist PREPARING then risk audit then SUBMITTING before sending; durable unresolved orders block
other keys for the account. Replays read the original order. Unknown outcomes require reconciliation,
never re-POST. Use current official paper TR IDs VTTC0012U/VTTC0011U and VTTC0081R.
Market-only v1; server quote, KIS no-margin buying power, sellable quantity and weekday KRX window.
Explicit paper execution opt-in and bearer token; debug risk endpoint cannot execute.
Paper v1 realized loss/streak remain explicit initial state until the later P/L ledger phase requested.
# Progress
Read repository rules, existing schema, adapters and architecture. Existing worktree clean.
No local Docker/PostgreSQL tools or .env discovered. Asked for deployment target asynchronously.
Implementation and local verification complete. A temporary PostgreSQL 17.6 installation outside
the repository was used for real database tests; no new project dependency was added.
Runbook: docs/PAPER_ORDERS.md. Architecture and decision 0005 record the limited paper risk state,
market-price limitation, manual recovery and additive migration rollback behavior.
# Validation
2026-09-16: pnpm typecheck, pnpm lint, pnpm build passed. Default pnpm test: 329 passed,
6 database tests skipped without the explicit disposable DB URL. With ORDER_TEST_DATABASE_URL:
335 passed, no skipped tests (21 files), including concurrent unique constraints, CAS, legacy row
preservation, cumulative snapshots and transaction rollback. Baseline before this task: 271 tests.
Compiled db:migrate ran successfully twice on a separate fresh PostgreSQL 17 database.
git diff --check passed. Tests use stubbed KIS transport; no broker order was sent.
Production wiring test exercises createRuntimeApp with its real KIS order adapter and a stubbed
fetch; server.ts injects the Drizzle repository. Secret-safe diagnostics and existing read/risk tests pass.
# Remaining Work
Operating server SSH target, deployment directory and existing Compose project were not supplied.
Docker image build/deployment and the actual KIS paper one-share BUY/holdings confirmation remain
unverified. Follow the runbook during the permitted market session once the environment is available.
Keep this plan active until that checkpoint is observed. Do not mark a mocked order as a real fill.

# Goal
Verify the current paper execution path locally and on the configured KIS paper deployment.
# Constraints
Paper only; existing deterministic risk and broker adapter remain mandatory. Preserve operational
data and credentials. No blind retries, fabricated fills, risk overrides or live orders.
# Plan
- [x] Run current repository checks and disposable PostgreSQL persistence tests.
- [x] Verify compiled migrations on a fresh disposable database and replay safely.
- [x] Verify Docker configuration/image and deployment health on the supplied environment.
- [x] Observe one-share paper BUY, reconciliation, matching holdings and idempotent replay.
- [x] Observe paper SELL, matching holdings and ledger-backed realized P/L/risk inputs.
- [x] Record local evidence and reconcile stale execution-ledger plan status.
# Decisions
Reuse existing tests and runbook. Local stubbed transport is not evidence of a KIS fill.
Deployment requires the actual SSH target, project directory and existing Compose project.
# Progress
2026-09-21: Read repository rules, architecture and paper runbook. Initial worktree clean.
Requested deployment coordinates; inspecting available local tooling without exposing secrets.
Deployment follow-up: user supplied jinsol@sol-server, ~/ai-trader-app and Compose project
ai-trader-app. Server was on 2411e64 with a modified Compose file using the existing external
network/database. KIS paper URL and paper mode verified in both Compose and running environment;
live disabled, paper execution initially enabled. No credentials were printed.
Existing 2026-09-17 Samsung BUY (local order 467788d4-04cc-49f7-872c-f1c40f4ff742,
broker ID 23317) is FILLED for one share / gross KRW 254,000; DB position and legacy-backfilled
execution match. Actual KIS portfolio returned the same one-share holding. Quote requests failed
with no HTTP response; diagnosis continues. No new broker submission was made.
At 17:34 KST, stopped the server and backed up its .env, Compose file and database under
/home/jinsol/ai-trader-backups/paper-e2e-20260921T173424 (custom dump 19,780 bytes;
pg_restore --list succeeded). Set paper execution false for deployment, restricted .env to mode
600, and fast-forwarded to 1ecd5e7 using a local Git bundle. Verified Compose remained byte-identical.
Docker build, migration and recreation succeeded. Host health returned 200 and the container is
healthy on Node 24.21.0. Token issuance and actual KIS historical-fill inquiry returned 200;
quantity and amount match the stored order exactly. Authenticated GET and two terminal reconcile
requests passed; unauthenticated GET returned 401. Disabled new submission returned 503 without
changing DB counts (one order, execution and fill snapshot).
Burst diagnostic reads produced EGW00201. With 1.5-second spacing, production HTTP portfolio,
quote, broker status and risk reads all returned 200. The predeployment quote timeout did not
recur; its exact cause is unproven. No source-code fix or automatic retry was introduced.
Current time is outside the enforced 09:00–15:20 KST weekday window; a new paper BUY/SELL
checkpoint cannot run now. Execution remains false; existing one-share holding is unchanged.
Detailed evidence and next-session steps: docs/PAPER_E2E_2026-09-21.md.
2026-09-22: KIS request pacing deployed. Runtime uses a 1.5-second minimum interval and queue
limit of eight. Portfolio, quote and broker status reads spaced 1.6 seconds apart returned 200;
no new EGW00201 appeared. Runtime remains paper/live false/execution false; DB counts remain
one order, one execution and one fill snapshot.
2026-09-22 15:31 KST preflight: the enforced order window had closed at 15:20, so no order was
submitted. Health, portfolio, quote and broker status each returned 200. Baseline was one
005930 share, one available share, average price KRW 254,000, current price KRW 276,500 and
valuation P/L KRW 22,500. Execution remained false.
# Validation
2026-09-28 13:41 KST: resumed Phase 6 preflight against the running deployment.
Health, portfolio and quote returned 200; runtime remained paper, live disabled, execution disabled,
kill switch false, with the exact KIS paper URL. Baseline: one available 005930 share with cost
KRW 254,000; current quote KRW 273,000. The sole order is FILLED and position-synchronized.
Counts: orders=1, executions=1, fills=1, strategy_runs=0. Every order's cumulative fill quantity
and amount matches its execution sum; no unresolved order exists. Broker holdings match ledger
quantity. Diagnostic BUY risk evaluation for one share at the fresh quote returned approved;
this is not an execution approval and does not submit an order. Account-exclusive-use confirmation
is pending before temporary execution opt-in and the one-share checkpoint. No new order submitted.

2026-09-21, source commit 1ecd5e7, Node 26.8.2 and pnpm 10.17.1:
- pnpm lint, pnpm typecheck and pnpm build passed.
- Initial local Vitest run: 404 passed, 10 database tests skipped.
- pnpm test with an explicit disposable ORDER_TEST_DATABASE_URL: 414 passed across 29 files,
  no skipped tests. PostgreSQL reported version 17.6.
- Covered legacy preservation, concurrent idempotency, account serialization, optimistic updates,
  atomic reconciliation/rollback, cumulative-fill deduplication, historical backfill, partial fills,
  cancellation, realized P/L, repository recreation and missing-history rejection.
- Compiled migrate.js succeeded twice against a separate fresh disposable database.
- Temporary PostgreSQL binaries/data were provisioned under /private/tmp; no project dependencies,
  lockfile, operational database or broker credentials were changed. Broker transports were stubbed.
- Temporary PostgreSQL shut down successfully after verification.
- Sandbox DNS, shared-memory and loopback restrictions required escalated tooling/DB commands;
  subsequent verification passed. Docker CLI is unavailable locally; no deployment .env exists here.
# Remaining Work
None for the normal full-fill checkpoint. Completed 2026-09-28 at 14:24–14:25 KST:
BUY and SELL each filled one share at KRW 272,750; quantities progressed 1 → 2 → 1.
Both new orders synchronized, and replay/reconciliation left counts at three orders, executions
and fill snapshots. Gross moving-average realized P/L is KRW 9,375; remaining cost KRW 263,375.
The production next-risk context reflected that P/L and zero consecutive losses. Execution was
disabled again; live remained disabled. Evidence: docs/PAPER_E2E_2026-09-28.md.
Actual partial-fill/unknown recovery and cross-process pacing remain outside this checkpoint.
Phase 5 scheduler dry-run evidence is tracked separately before Phase 7.

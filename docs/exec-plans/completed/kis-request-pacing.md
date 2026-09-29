# Goal
Prevent bursts from the single production KIS session while preserving order freshness and no retries.
# Constraints
Paper only; no live orders, policy weakening, broker bypass, credentials or dependency changes.
Preserve previous verification documentation and server-specific Compose/.env settings.
# Plan
- [x] Reproduce concurrent/serial burst behavior with deterministic transport tests.
- [x] Add shared bounded pacing for token, reads and order requests in the KIS client.
- [x] Recheck application quote/session guard immediately before dispatch after queue/token waits.
- [x] Prove known-unsent expiration versus ambiguous POST handling and run repository checks.
- [x] Deploy exact reviewed patch with execution disabled; verify burst reads and preserved DB history.
- [ ] Record results and remaining in-session paper BUY/SELL checkpoint.
# Decisions
Use a conservative 1.5-second minimum start interval, matching successful server diagnostics.
One queue per composed KIS client; one production broker instance. No cross-process quota guarantee.
At most eight outstanding requests; excess work fails closed. No automatic retries, including reads.
The application supplies a final synchronous quote/session guard. A typed definitely-not-sent
failure becomes FAILED; transport/malformed-response ambiguity remains UNKNOWN and blocks retries.
# Progress
Read applicable rules, architecture, active plans and transport/application tests. Prior deployment
observed EGW00201 on immediate sequential reads, with 1.5-second spaced reads succeeding.
# Validation
2026-09-22: pacing tests, KIS/ordering tests (125/125), full suite (407 passed, 10 DB tests
skipped without a disposable URL), lint, typecheck and production build passed. Runtime uses a
1.5-second minimum start interval per composed KIS client, a FIFO queue capped at eight outstanding
requests, and no retries. Direct test adapters default to zero interval.

Deployed to `jinsol@sol-server:~/ai-trader-app` with the existing Compose override, database and
`.env` preserved. Docker build, migration and server recreation succeeded. Runtime confirmed
`BROKER_MODE=paper`, `LIVE_TRADING_ENABLED=false`, `PAPER_ORDER_EXECUTION_ENABLED=false`.
Container is healthy; health 200. Portfolio, quote and broker-status requests spaced 1.6 seconds
apart all returned 200, with no new EGW00201 log. Database counts remain orders=1, executions=1,
order_fills=1. No broker order was submitted.
After a diagnostic shell quoting error, the private order API token was rotated without printing
the replacement; server recreation and health 200 succeeded. Runtime remains execution false.
# Remaining Work
The pacing patch is complete. New paper BUY/SELL reconciliation and realized-P/L evidence still
require a permitted market session; execution is intentionally disabled after deployment.

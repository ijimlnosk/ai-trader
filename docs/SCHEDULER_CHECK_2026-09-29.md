# Production scheduler verification — 2026-09-29

## Result

Phase 5 passed at 11:07 KST. The authenticated order-free scheduler persisted exactly one run,
returned the same complete parsed record on replay, and rejected changed data under the same key
with 409 `idempotency_conflict`. `result.order` was null. Orders, executions and fills stayed at
3 each; full-row SHA-256 snapshots were identical before and after both attempts.

Run key: `paper-dry-run-20260929-2ce421f27807`.
Dataset SHA-256: `2ce421f27807fae0ec69592a10dcb79eeaf9ee02d322fa41f05b6eb6c21926a4`.
Persisted session: `20260929`; created at `2026-09-29T02:07:35.973Z`.
Strategy output: `005930`, `TREND_EXIT`, SELL 1, deterministic risk approved. This was a proposal
only, not an order or fill. Paper execution and live trading remained false throughout.

## Data recheck and provenance

The [9/28 preparation](SCHEDULER_PREP_2026-09-28.md) supplied the independent calendar check.
At 10:54:59 KST on 9/29 the same KIS raw daily query, ending at 9/28, returned all 100 expected
dates unchanged. OHLC prices were unchanged, but the 9/28 volume was revised from 20247374 to
21346064. The old request was never sent. A new archive/request/digest was prepared before any
scheduler request; no saved run's data was changed. Today's unfinished bar was excluded.

Private archive: `/home/jinsol/ai-trader-backups/scheduler-check-20260929`.
Contains raw response/provenance, normalized data, exact request, conflict request, calendar,
revision comparison, verifier, initial failed verification, read-only diagnosis and passing retry.
Passing evidence: `verification-retry.json`, `passed: true`; verifier/remote process exited 0.
The failed initial evidence is preserved as `verification.json`.

## Initial rejection and unresolved availability issue

At 10:59:27 KST the first attempt returned 503 `order_context_unavailable`, with zero saved runs
and unchanged ledgers. Its exact throw site was not logged. A subsequent read-only diagnostic
using deployed broker/risk code demonstrated the strategy's two-read valuation race: both
portfolio schemas were valid, cash and one-share holdings matched, and ledger coverage matched,
but equity moved from 10019365 to 10019865 between reads. The second risk context was valid;
the strategy's exact equity comparison against the first snapshot would reject it.

This supports the likely cause of the initial rejection, not proof of its unlogged throw site.
One bounded retry reused the identical request/key without changing any guard, clock, input or
configuration. It passed. No further retries were made. The two-read availability issue is not
fixed; coherent account/risk snapshots and regression proof should precede automatic-loop
commissioning. Equality guards must not simply be removed to force acceptance.

## Validation and state

- First/replay HTTP 200; deep structural equality includes timestamps, indicators, risk context,
  policy, decision and null order. JSONB object key order differs, so byte equality is not required.
- Changed attribution with unchanged run key: 409 `idempotency_conflict`.
- `strategy_runs`: 0 → 1, matching run key/session/hash.
- Orders/executions/fills: 3 → 3 each, all full-row hashes unchanged.
- Post-check server healthy, database connected, paper mode, live false, paper execution false.
- No product code/deployment change. Reused 9/28 local gates for unchanged source: lint,
  typecheck and build passed; 410 tests passed, 10 disposable-DB tests skipped.
- Documentation whitespace check passed.

Phase 5 and Phase 6 evidence gates are complete. Phase 7 implementation can proceed under its
existing plan; the automatic paper loop is not implemented, scheduled or enabled by this check.

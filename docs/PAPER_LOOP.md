# Bounded paper loop v1

The loop is implemented for `005930` only. It reuses Strategy → Risk → Execution → KIS paper;
there is no AI, live mode, data ingestion, calendar discovery, quantity override or order retry.
`POST /api/v1/strategy/schedule` remains order-free and its records cannot activate execution.

## Admission and configuration

`PAPER_LOOP_ENABLED=false` and `PAPER_ORDER_EXECUTION_ENABLED=false` are the defaults.
Both must be explicitly true for a new claim; loop opt-in requires an API token of at least
32 characters. Keep `BROKER_MODE=paper`, `LIVE_TRADING_ENABLED=false`. The existing BUY kill
switch still permits valid SELL, while paper execution OFF prevents all new submissions.
Apply environment changes by recreating the existing server; accepted orders are not cancelled.

The authenticated `POST /api/v1/strategy/paper-loop/tick` uses the existing ORDER_API_TOKEN and
returns a durable run. Supply this JSON shape (replace descriptive placeholders with real values):

```json
{
  "runKey": "operator-unique-run",
  "sessionDate": "YYYYMMDD",
  "dataSha256": "sha256-of-JSON.stringify-of-the-normalized-dataset",
  "dataRef": "private-archive-reference",
  "calendar": { "source": "independently-checked-calendar-reference", "sessions": ["historical dates", "sessionDate"] },
  "data": { "source": "provider provenance", "timezone": "Asia/Seoul", "priceBasis": "raw", "sessions": ["historical dates"], "series": [] }
}
```

Use the existing dataset parser before hashing. The one series must be `005930`; its candles
must exactly match historical sessions. `calendar.sessions` must equal historical dates followed
by the declared session, strictly increasing valid weekdays. OHLCV/schema/digest are checked.
Calendar source and archive reference are retained audit references, not fetched URLs or file paths.
An operator must independently confirm calendar completeness, provider revisions and session
operation; the server cannot certify a calendar merely because a caller supplied a source string.

A new tick requires the actual declared Seoul weekday, 09:00 inclusive to 15:20 exclusive, a
completed bar no older than 96 hours and exactly the next calendar weekday. Holiday gaps and
special sessions are unsupported. A closed session or invalid input submits nothing. Execution
still independently rechecks account, ledger, quote age, session, buying power and deterministic risk.

## Durable states and recovery

`paper_loop_runs` is account-scoped and separate from dry-run records. It stores the entire input,
order key, result, order snapshot, reason, two-minute reconciliation deadline and optimistic version.
The key binds the strategy identity/version, symbol and completed bar before any execution call.
Unique account/run and account/order indexes prevent changing keys to submit twice; a partial
unique account index allows only one unfinished loop claim. Existing order reservation is a
second independent financial guard. No DB transaction spans broker calls.

- `CLAIMED`: only the atomic claim winner may evaluate. A replay with no identifiable order
  remains blocked; there is no claim expiry or automatic resubmission. It may be an in-flight
  winner or a crash before reservation, so an operator must investigate.
- `TRACKING`: the retained order key identifies the order. Each tick performs at most one
  existing reconciliation call, only for a known non-ambiguous order and before the deadline.
- `COMPLETE`: no proposal/HOLD, risk denial, terminal rejection/failure, or terminal synchronized
  order. Replays return the stored record without recalculating strategy after holdings change.
- `HALTED`: unknown submission, missing identity, expired reconciliation deadline, or an exception
  around evaluation/persistence. Retain the claim and investigate; never clear it to force retry.

Account-scoped order-key lookup recovers a crash after reservation or acknowledgement but before
loop linkage. The order's strategy data hash must match. PREPARING/SUBMITTING/UNKNOWN never trigger
automatic broker-ID guessing or submission. Explicit `/orders/:id/reconcile` remains available
with both opt-ins off. After an operator resolves/synchronizes a known order, repeat the unchanged
tick to record completion, even outside the new-order session or with opt-ins off. A crash with
no order requires separately reviewed recovery; there is intentionally no blind unlock endpoint.

Halted or recovered runs may lack the original strategy result after a crash; order provenance
and risk audit remain in the order. Compare `run.order` for the latest linked state; `run.result`
retains the initial strategy evaluation. Different input, session, archive reference or run key
for an already claimed bar returns 409. Competing optimistic updates may also return 409; inspect
stored state using the unchanged tick, never a new key.

## Optional trigger

Omit `PAPER_LOOP_TASK_FILE` for manual ticks only. With loop opt-in and a task file, the same
server process validates/loads one local JSON task (maximum 1 MiB) on startup and ticks once after
readiness. It then ticks every 30 seconds only while TRACKING, without overlapping its own work.
It shares the composed KIS client and pacing. COMPLETE, HALTED, abandoned CLAIMED or an exception
stops the trigger. There is no catch-up, midnight task replacement or automatic retry of admission.
Start/recreate during the intended session; a pre-open start rejects and stops rather than waiting.

To use a file in Docker, supply a read-only task mount and `PAPER_LOOP_TASK_FILE` through a reviewed
Compose override. The base Compose intentionally provides no task mount/path, and defaults loop OFF.
Never mount credentials as task content. Shutdown stops the trigger in preClose and awaits in-flight
work before closing the DB. If shutdown times out, durable claims/orders govern restart recovery.
The two-minute deadline bounds new reconciliation starts, not a hard cancellation of a broker read
already underway. No broker writes are automatically retried.

## Deployment and commissioning

Follow [the existing deployment procedure](PAPER_ORDERS.md), backing up the existing DB and applying
additive migration `0004_paper_loop_claims.sql`. Keep both execution switches false for deployment.
Verify health, authenticated disabled tick, no loop rows/orders created, and dry-run replay parity.
Preserve old financial rows and all claim identities on rollback; disable both flags, recreate the
server and use explicit reconciliation for already accepted orders. Do not roll back over pending
work without investigation. The old binary ignores loop claims, so it must remain execution-disabled.

A later bounded commissioning session needs an exclusive paper account, independently verified
archived data/calendar, one reviewed task, agreed operating window, and explicit loop + paper
execution opt-ins. Strategy sizing is unchanged; do not force a signal or truncate quantities.
Retain results and disable again. A HOLD demonstrates a tick, not a strategy-generated fill.

# Paper execution and Trade Ledger v1 runbook

Only human-operated KIS paper MARKET orders are implemented. No AI, strategy, live orders, automatic
resubmission or cancel/amend API. Confirmed execution history now supplies gross daily realized P/L
and consecutive losses to risk. Fees/taxes are excluded; policy thresholds are unchanged.

## Configuration

Keep BROKER_MODE=paper, LIVE_TRADING_ENABLED=false and the default KIS paper URL. Use the existing
paper app credentials and 8-digit account / 2-digit product code. Add to the existing private `.env`:

```dotenv
PAPER_ORDER_EXECUTION_ENABLED=false
ORDER_API_TOKEN=<independently-generated-secret-of-at-least-32-characters>
TRADING_KILL_SWITCH_ENABLED=false
```

Generate/store the token through your secret-management workflow; never commit or share it.
Enable execution only for the checkpoint. TRADING_KILL_SWITCH_ENABLED=true blocks new BUY through
risk while allowing valid SELL liquidation. PAPER_ORDER_EXECUTION_ENABLED=false blocks all new
submissions, while authenticated GET/reconciliation remain usable with the repository/token configured.
Environment switches take effect after server recreation and do not cancel broker orders in flight.

## Deploy to the existing Compose project

All migrations, including 0002 executions/backfill, are required. Use the same `.env`, project, DB service/network and external volume.
Take a DB backup with the existing operations procedure first. Stop competing order writers. Do not
recreate the database or use `down -v`. Replace the project placeholder with its existing name:

```bash
docker compose -p <existing-project> config --quiet
docker compose -p <existing-project> build server
docker compose -p <existing-project> run --rm --no-deps server node dist/infrastructure/database/migrate.js
docker compose -p <existing-project> up -d --no-deps server
curl --fail http://127.0.0.1:3200/health
curl --fail http://127.0.0.1:3200/api/v1/portfolio
```

Keep execution disabled until health/portfolio succeed and ledger coverage is verified as below. Set PAPER_ORDER_EXECUTION_ENABLED=true in
the existing private environment and repeat `up -d --no-deps server`. Keep the API loopback/private;
use an SSH tunnel or authenticated TLS ingress. Do not print rendered Compose secrets.

Rollback: disable execution and recreate server. Preserve the expanded schema and all order records.
Reconcile pending orders before changing binaries. Old read-only binaries do not manage new states.

## One-share checkpoint

Use a weekday 09:00–15:20 Asia/Seoul continuous session; the broker also enforces holidays/suspensions.
Record the initial 005930 quantity from GET /api/v1/portfolio. Avoid manual HTS orders on this account.
Supply the token via your local secure environment as ORDER_API_TOKEN. Generate and retain one UUID
per intended order; the same UUID and payload must be reused after any client/server timeout.

```bash
ORDER_KEY="$(uuidgen)"
curl --fail-with-body --silent --show-error \
  -H "Authorization: Bearer ${ORDER_API_TOKEN}" \
  -H "Idempotency-Key: ${ORDER_KEY}" -H 'Content-Type: application/json' \
  --data '{"symbol":"005930","side":"BUY","quantity":"1","orderType":"MARKET","confidence":"0.82"}' \
  http://127.0.0.1:3200/api/v1/orders
```

No estimatedPrice is accepted. The server quote becomes requestedPrice, while KIS MARKET ORD_UNPR
is 0. Preserve the returned local `id`, `brokerOrderId`, Location and your ORDER_KEY. Risk rejection
returns a saved RISK_REJECTED record and reasons without submitting. Submitted/unknown states return
202; terminal states return 200. A different payload with the same key or a second unresolved order
returns 409. Invalid input returns 400; unauthorized returns 401; provider/DB service errors are generic.

After setting ORDER_ID to the returned local UUID:

```bash
curl --fail-with-body -H "Authorization: Bearer ${ORDER_API_TOKEN}" \
  "http://127.0.0.1:3200/api/v1/orders/${ORDER_ID}"
curl --fail-with-body -H "Authorization: Bearer ${ORDER_API_TOKEN}" \
  -H 'Content-Type: application/json' --data '{}' \
  "http://127.0.0.1:3200/api/v1/orders/${ORDER_ID}/reconcile"
curl --fail http://127.0.0.1:3200/api/v1/portfolio
```

GET is a DB read; it does not automatically refresh broker status. Reconciliation is an explicit
read from KIS and can be repeated with provider quota spacing. Success requires brokerStatus=FILLED,
filledQuantity=1 and non-null positionsSyncedAt, plus 005930 holdings exactly one above the baseline
in the paper account. The DB position mirror is updated from broker holdings, not from order acceptance.
Quote estimates can differ from market execution; filledAmount records the broker cumulative amount.

## Unknown outcome and recovery

On timeout, replay the original POST with the **same key and identical payload** to recover the local
record. Never send the same intended order under a new key. UNKNOWN/SUBMITTING blocks the account.
If no broker ID was saved, inspect the KIS paper account's order history and independently identify
the exact order; only then send `{"brokerOrderId":"<confirmed-id>"}` to the reconciliation endpoint.
The server checks account-scoped identity, date, symbol, side and quantity. It does not infer an ID.
An absent/mismatched record, malformed provider data or portfolio failure leaves the order unresolved.
Recent-order reconciliation supports the official within-three-months paper query mode only.

PREPARING after a process crash also stays blocked. Disable execution and investigate the durable
state and broker history; v1 has no automated recovery/unlock command for this case. Do not manually
delete orders, clear the partial-index blocker or fabricate FILLED just to admit another order.
If holdings differ because of external trading or delayed balance settlement, keep the account
blocked and investigate; do not automatically resubmit the original order.

## Verification

Automated tests never place KIS orders. Standard checks: pnpm typecheck, pnpm lint, pnpm test, pnpm build.
Database tests require an **empty disposable local PostgreSQL 17 database**, not DATABASE_URL:

```bash
ORDER_TEST_DATABASE_URL=postgresql://<local-test-user>@127.0.0.1:<port>/ai_trader_order_test_<unique-suffix> pnpm test
```

The test runs all three migrations and checks legacy preservation, concurrent idempotency, account gating,
optimistic updates, deduplicated executions, historical backfill, ledger completeness, P/L,
account isolation, restart recovery and transaction rollback. Each run needs a new empty
DB. Default tests skip this suite when the explicit test URL is absent. Actual deployment, broker
acceptance and account holdings must be verified separately using the checkpoint above.


## Ledger verification and coverage

Migration 0002 imports already-confirmed cumulative fills from existing account-scoped orders,
including a previous successful BUY. An accepted order with filledQuantity=0 must still be reconciled;
order acceptance is never an acquisition cost. Reconcile outstanding orders before the next submission.
Repeated identical queries must not add executions; partial queries add only the positive difference.
A FILLED result whose broker balance has not caught up remains blocking until synchronization succeeds.

Inspect `executions` using the existing private DB administration connection. For each order, the sum
of quantity/amount must equal the order's filled_quantity/filled_amount. Each row includes the source
(reconciliation or legacy_order_backfill), order/account scope, side, date and cumulative watermark.
Account identifiers remain hashes. Order `risk_audit.context` stores the actual daily P/L, loss streak
and operational switch consumed by that order's decision. The broker position mirror is a valuation
snapshot; its legacy realized_pnl column is not authoritative. Realized P/L is derived from executions.

Before enabling execution, call the existing debug risk endpoint with a normal proposal and check for
INVALID_CONTEXT or risk_context_unavailable. Those require investigation, not altered risk limits.
Compare broker holdings with ledger BUY minus SELL quantities and ensure each sale has preceding
acquisition cost. A valid account with no trade history and no holdings starts at zero. Untracked
holdings fail closed for BUY and SELL; there is no automatic import of arbitrary external trades,
manual opening-balance override, or estimated cost seeded from current price/portfolio average.
If history is incomplete, keep execution disabled and reconstruct verified historical records through
a reviewed data repair. Do not delete filled orders or insert fabricated zero-cost acquisitions.

For a completed BUY/SELL round trip, ledger gross P/L is confirmed sell amount less allocated buy cost.
Partial disposal uses moving-average acquisition cost; residual precision remains with unsold shares.
Daily realized P/L uses the Seoul trading date, not the reconciliation request date. A next-day
reconciliation therefore does not move yesterday's result into today's loss limit. Three consecutive
net losing SELL orders stop new BUY under the unchanged policy; breakeven/profitable SELL resets the
streak, BUY does not, and midnight resets only daily P/L. Partial executions of one SELL count once.

KIS cumulative amounts omit fee/tax accounting in this implementation. Gross P/L can differ from
broker net results; automated/live operation is not authorized by this phase. Kill switch is read from
TRADING_KILL_SWITCH_ENABLED on server startup for both risk evaluation and execution. Keep an exclusive
paper account: same-quantity external round trips and corporate actions cannot be inferred here.

Rollback keeps executions and historical fill snapshots intact and disables order execution first.
Do not enable orders on the older binary with placeholder risk history. No down migration deletes
financial history. Deployment and actual KIS fill/holdings verification are separate from local tests.

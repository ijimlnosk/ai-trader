# Paper order v1 runbook

Only human-operated KIS paper MARKET orders are implemented. No AI, strategy, live orders, automatic
resubmission, cancel/amend API or realized P/L ledger. The initial daily realized P/L and loss streak
remain 0; these risk checks do not yet reflect account losses. Policy thresholds are unchanged.

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

The migration is required. Use the same `.env`, project, DB service/network and external volume.
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

Keep execution disabled until health/portfolio succeed. Set PAPER_ORDER_EXECUTION_ENABLED=true in
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

The test runs both migrations and checks legacy preservation, concurrent idempotency, account gating,
optimistic updates, deduplicated fill snapshots and transaction rollback. Each run needs a new empty
DB. Default tests skip this suite when the explicit test URL is absent. Actual deployment, broker
acceptance and account holdings must be verified separately using the checkpoint above.

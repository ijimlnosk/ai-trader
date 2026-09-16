# AI Trader backend foundation

Fastify / TypeScript / PostgreSQL 17 / Drizzle. KIS paper quotes/portfolio, deterministic Risk Engine,
and opt-in human paper MARKET orders. No live trading, strategy or AI.

See [paper order deployment and verification](docs/PAPER_ORDERS.md) before enabling execution.

Paper-order v1 validation (2026-09-16): typecheck, lint, build and 335 tests passed with a disposable
PostgreSQL 17 database, including migration replay. Docker deployment and an actual KIS paper fill
have not been verified in this workspace. Execution defaults to disabled.

## Prerequisites

Use Node.js 24 LTS and pnpm 10.17.1 (`npm install --global pnpm@10.17.1`).
TypeScript stays on 5.9 for typescript-eslint compatibility; dependency resolutions are committed in pnpm-lock.yaml.

## Local development

```bash
pnpm install
cp .env.example .env
# Edit .env with your LOCAL PostgreSQL connection, e.g. localhost instead of db.
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm --filter server db:migrate
pnpm --filter server start
# In another terminal:
curl --fail http://127.0.0.1:3000/health
```

Use `pnpm --filter server dev` for watch mode. Default tests use injected ports; optional order repository
tests require a separate disposable PostgreSQL database (see the paper order runbook).
A real PostgreSQL 17 instance must be provisioned separately for local start/migration.
`.env` is ignored; scripts load the root `.env`. Exported environment variables take precedence.
Do not publish credentials or paste rendered Compose configuration containing secrets.

## Environment

| Variable | Meaning / default |
| --- | --- |
| NODE_ENV | development / test / production; default development |
| HOST | default 0.0.0.0 |
| PORT | integer 1–65535; default 3000 |
| DATABASE_URL | required PostgreSQL URL; Docker host `db:5432`, local host depends on local setup |
| BROKER_MODE | paper (default) / live; live startup is rejected in this version |
| LIVE_TRADING_ENABLED | exact true / false, defaults false; alone never enables live |
| PAPER_ORDER_EXECUTION_ENABLED | exact true / false, defaults false; explicitly enables human paper submission |
| ORDER_API_TOKEN | secret of at least 32 characters required when execution is enabled; bearer auth for all order routes |
| TRADING_KILL_SWITCH_ENABLED | exact true / false, defaults false; blocks new BUY through execution risk, allows valid SELL |
| POSTGRES_DB | Compose default ai_trader |
| POSTGRES_USER | Compose default ai_trader |
| POSTGRES_PASSWORD | required for Compose; no committed value |
| POSTGRES_VOLUME_NAME | required existing PostgreSQL 17 named volume |

Docker DATABASE_URL format: `postgresql://ai_trader:<URL-encoded-password>@db:5432/ai_trader`.
Set the raw password in POSTGRES_PASSWORD; percent-encode special characters in the URL.
Changing POSTGRES_PASSWORD does not rotate an existing PostgreSQL volume's password.
Invalid environment values fail startup. Empty safety flags are rejected, not coerced.

## Migrations

```bash
# Local: offline generation; does not connect to the database.
pnpm --filter server db:generate
# Local: explicitly apply to DATABASE_URL after reviewing SQL.
pnpm build
pnpm --filter server db:migrate
```

Initial SQL and Drizzle metadata live in `apps/server/drizzle`. Migrations never run on server startup.
Health checks connectivity, not schema version; apply migrations separately before using future persistence features.

## Ubuntu server / existing Docker PostgreSQL

Do not run a second PostgreSQL container against the mounted existing volume. First identify the
existing Compose project name, working directory, service configuration and volume with read-only tools:

```bash
docker compose ls
docker ps --format '{{.Names}}'
docker inspect <existing-db-container> --format '{{json .Config.Labels}}'
docker inspect <existing-db-container> --format '{{json .Mounts}}'
```

Back up the DB before applying migrations. Integrate this file's server service into the existing Compose
project if its configuration differs. Preserve its DB mounts, project name and network. Set
POSTGRES_VOLUME_NAME to the exact existing named volume, never a guessed/new name. This supplied DB
mount assumes the existing PG17 data is at `/var/lib/postgresql/data`; verify existing PGDATA too.
The following commands assume this file matches the existing DB service and uses its project name;
`--no-deps` intentionally avoids recreating the running DB:

```bash
cp .env.example .env
chmod 600 .env
# Edit .env: existing DB credentials, DATABASE_URL host=db, exact volume name, paper/false.
# Replace <existing-project> with the existing Compose project label.
docker compose -p <existing-project> config --quiet
docker compose -p <existing-project> build server
# Explicit migration only after SQL review and backup:
docker compose -p <existing-project> run --rm --no-deps server node dist/infrastructure/database/migrate.js
docker compose -p <existing-project> up -d --no-deps server
curl --fail http://127.0.0.1:3200/health
docker compose -p <existing-project> logs --tail=100 server
```

For a NEW disposable/local Compose environment only, explicitly create a new volume and set its name,
then use `docker compose up -d db` before migration/server start. No volume creation/deletion is automated.
Never run `docker compose down -v` or `docker volume rm` on existing infrastructure.
PostgreSQL has no host port binding. HTTP binds `127.0.0.1:3200:3000`.

Expected health: `{"status":"ok","database":"connected","tradingMode":"paper"}`.
Database failure returns HTTP 503 with `status=error`, `database=disconnected`, no credentials.

## Schema and next boundary

See [architecture](docs/ARCHITECTURE.md). Tables: trade_proposals, orders, order_fills, positions,
portfolio_snapshots. Money/price/quantity use numeric(24,8) as strings, currency is explicit,
timestamps are timestamptz. Risk uses exact fixed-scale BigInt arithmetic. Orders retain a full risk
audit and durable idempotency states. Migration 0001 is required before paper order execution.

## Initial foundation verification (historical)

`pnpm install`, `pnpm typecheck`, `pnpm lint`, `pnpm test` (22 tests), `pnpm build`, offline migration
SQL generation, and production-only deploy packaging passed. Compiled startup rejection for missing
configuration, live mode and unavailable DB also passed without leaking the test password.
Checks ran on Node 26.7.0; the image targets Node 24 LTS.
Docker and PostgreSQL binaries were unavailable, so actual image build, real DB connection and migration
application are **not verified**. No production migration was attempted. See the active execution plan.

## KIS paper quotes

Set `KIS_APP_KEY` and `KIS_APP_SECRET` to paper credentials in the existing `.env`.
`KIS_BASE_URL` defaults to `https://openapivts.koreainvestment.com:29443`; other URLs fail validation.
Keep `BROKER_MODE=paper` and `LIVE_TRADING_ENABLED=false`.
`KIS_ACCOUNT_NO` (8 digits) and `KIS_ACCOUNT_PRODUCT_CODE` (2 digits) are required for portfolio queries.
`configured` means that the app key and secret are present; account fields are not required for quotes.

For the historical quote-only change no migration was needed. Current paper-order deployments must
first follow the migration steps in [the order runbook](docs/PAPER_ORDERS.md). Read-only checks:

```bash
docker compose -p <existing-project> config --quiet
docker compose -p <existing-project> build server
docker compose -p <existing-project> up -d --no-deps server
curl --fail http://127.0.0.1:3200/health
curl --fail http://127.0.0.1:3200/api/v1/broker/status
curl --fail http://127.0.0.1:3200/api/v1/market/005930/quote
```

Reuse the existing `.env`, Compose project, database network and volume. The two KIS curl calls
perform real read-only paper API requests; automated tests use stubs and never contact KIS.
Status returns HTTP 200 with `configured`, `reachable` and, on failure, an `error` code.
It actively probes 005930, so polling consumes provider quote quota. The Docker healthcheck stays on `/health`.
Token cache is in-memory per server, refreshed 60 seconds before expiry, with concurrent issuance deduplicated.
It is cleared on restart and not shared across replicas. A failed request is not automatically retried.

Quote response fields: `symbol`, `price` (KRW), `change` (KRW), `changeRate` (percent),
`volume` (cumulative shares), `timestamp` (UTC receipt time, not the exchange's last-trade time).
All financial values remain strings. Provider data is validated by Zod; raw fields/messages are not exposed.
Invalid symbols return 400; configuration/provider unavailability 503; authentication/invalid response 502.
These read endpoints never execute orders. The separate authenticated order endpoint always runs Risk Engine.

Official references: [token request](https://github.com/koreainvestment/open-trading-api/blob/main/examples_llm/auth/auth_token/auth_token.py),
[domestic quote request](https://github.com/koreainvestment/open-trading-api/blob/main/examples_llm/domestic_stock/inquire_price/inquire_price.py),
[quote field mapping](https://github.com/koreainvestment/open-trading-api/blob/main/examples_llm/domestic_stock/inquire_price/chk_inquire_price.py).

Initial quote implementation validation: `pnpm typecheck`, `pnpm lint`, `pnpm test` (59 tests) and
`pnpm build` passed. Docker CLI is unavailable in the implementation workspace; the image and real
KIS connection must be verified on the deployment host. See
[completed implementation plan](docs/exec-plans/completed/kis-paper-quotes.md).

## Paper account portfolio

`GET /api/v1/portfolio` reads the configured KIS paper account through the application AccountBroker
port. It shares token issuance/cache with quotes and status; no balances are written to PostgreSQL.
Missing/invalid account configuration returns `configuration_error` (503) without a provider request.
Quote and broker status still work without account fields; status continues to probe quotes only.
Account number and product code must be separate, e.g. 8 digits and a two-digit code with its leading zero.

| Portfolio field | Meaning / mapping |
| --- | --- |
| cash | `dnca_tot_amt`: deposit balance in KRW, not buying power/withdrawable cash |
| totalEvaluation | `tot_evlu_amt`: KIS total account evaluation in KRW |
| totalPurchaseAmount | `pchs_amt_smtl_amt`: holdings purchase cost in KRW |
| totalProfitLoss | `evlu_pfls_smtl_amt`: holdings valuation P/L in KRW |
| totalProfitLossRate | P/L / purchase cost × 100, two decimals, half away from zero |
| positions | Positive-quantity holdings; temporarily retained zero-quantity rows are omitted |

Position fields: symbol/name, quantity/availableQuantity (shares), averagePrice/currentPrice (KRW),
evaluationAmount/profitLoss (KRW), profitLossRate (percentage). All numeric fields remain strings.
Total percentage uses exact BigInt arithmetic; zero cost and zero P/L returns `0.00`.
Zero cost with nonzero P/L is rejected, not fabricated. The result is not historical trading performance.

KIS paper balances are paginated. The adapter follows continuation headers/keys, waits one second
between pages, and never adds repeated account-wide totals. A repeated cursor, duplicate symbol,
changed summary, missing continuation header or more than 20 pages fails with
`provider_invalid_response` (502); a later failure never returns partial positions.
These checks detect some changes during paging but do not guarantee a broker-side atomic snapshot.
Absent/empty account summary returns `account_unavailable` (503); malformed fields return
`provider_invalid_response` (502). Other provider/authentication errors retain the quote API categories.
Responses set `Cache-Control: no-store`; provider payloads/account credentials are not logged or returned.

For the historical portfolio-only change no migration was needed. For the current version, follow
the order migration runbook before restarting the server. Portfolio checks use the existing project:

```bash
docker compose -p <existing-project> config --quiet
docker compose -p <existing-project> build server
docker compose -p <existing-project> up -d --no-deps server
curl --fail http://127.0.0.1:3200/api/v1/portfolio
```

The curl performs an actual read-only account query. Automated tests use stubs.
Existing Compose variables already pass account credentials; DB service/volumes/networks are unchanged.
Official references: [balance request and pagination](https://github.com/koreainvestment/open-trading-api/blob/main/examples_llm/domestic_stock/inquire_balance/inquire_balance.py),
[balance field mapping](https://github.com/koreainvestment/open-trading-api/blob/main/examples_llm/domestic_stock/inquire_balance/chk_inquire_balance.py).

Portfolio validation: `pnpm typecheck`, `pnpm lint`, `pnpm test` (117 tests) and `pnpm build`
passed. No actual account query or deployment was performed during implementation. See
[completed portfolio plan and changed-file list](docs/exec-plans/completed/kis-portfolio.md).

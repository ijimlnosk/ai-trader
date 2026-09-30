# Daily data pipeline (phase A) deployment — 2026-09-29

## Result

Commit `26dd018` (KRX calendar, KIS daily history, `market_daily_snapshots`, collect/prepared
endpoints, calendar-based loop/strategy session check) is deployed to `sol-server`, Compose project
`ai-trader-app`, with paper execution and the loop off. No tick or order was sent.

Private evidence: `/home/jinsol/ai-trader-backups/data-pipeline-deploy-20260929`.

## Deployment (13:51–14:01 KST)

- Backups: source of replaced files, `.env`, Compose file, custom-format DB dump (`pg_restore
  --list` ok). Ledger snapshot equal to the post-commissioning state (orders/executions/fills 4).
- Runtime files changed since `68d80d1` extracted over the deployed tree (17 files, package SHA-256
  `1864f2aa9ff103e11b10180e0728c610eb5a85945dd62f99c6cf6bc38cdb20a4`); `.env` and Compose unchanged.
- Image built; migration 0005 applied; server recreated, healthy; all switches false.

## Verification (14:01–14:03 KST)

- New endpoints return 401 without the token.
- `POST /api/v1/market/daily-snapshots/collect` archived 100 bars through `20260928`, calendar
  `krx-2026-v1`, dataset SHA-256 `520d9a19ff2a…`, candles SHA-256 `1b0475e63788…`, no revisions.
  A repeated call returned `unchanged` with the same id; the table holds one row.
- `GET /api/v1/strategy/paper-loop/prepared` returned `ready` for session `20260929`, run key
  `loop-20260929-520d9a19ff2a`. Its sessions, calendar and all 100 candles are deep-equal to the
  independently collected and calendar-checked Phase 5 dataset used for commissioning; its digest
  validates. It was not sent to the tick endpoint.
- Orders/executions/fills/strategy runs hashes and the loop row count unchanged.
- The old deployment smoke now reports `passed: false` only because an authenticated disabled
  tick for the commissioned bar returns the stored `COMPLETE` run (200) instead of 503; that is
  the documented replay behavior after commissioning.

## Observation

The first collect after the restart returned 503 `provider_unavailable` after 10.02 s, consistent
with the KIS client's request timeout while the new process obtained its first token; no KIS
diagnostic line identified the cause. The next call succeeded in 4.2 s. Collection is read-only
and idempotent, so a failed attempt has no side effect, but phase B must treat a failed
collection as "retry later / skip", never as missing data to fill.

## Remaining

After 18:30 KST, collect through `20260929` and compare against a manual pull; on 2026-09-30
confirm the prepared input. Phase B code is deployed but disabled (below).

## Phase B deployment, disabled (14:36–14:47 KST)

Commit `fa6fc6c` (daily schedule, timer, environment guards) deployed the same way; 4 runtime files,
package SHA-256 `277da10a30dd8ec90ea70ae51ed45c8709c4a38a00630d5fb78842a9924e39aa`. Evidence:
`/home/jinsol/ai-trader-backups/daily-schedule-deploy-20260929` (source, `.env`, Compose, DB dump
with `pg_restore --list` ok, before/after ledger snapshots). `.env` and Compose unchanged.

- Healthy; paper, live/execution/loop false. The server-specific Compose file does not pass
  `MARKET_DATA_SCHEDULE_ENABLED` or `PAPER_LOOP_SCHEDULE_ENABLED`, so both are unset (default false);
  enabling requires adding them there. No `Daily schedule` log events after start.
- The first collect after this restart returned `unchanged` (same snapshot id) without timeout.
- Ledger hashes and loop row count unchanged.

## Collection schedule enabled (14:49 KST)

Order-free collection only. Evidence: `/home/jinsol/ai-trader-backups/collection-enable-20260929`
(`.env` and Compose backups). The server-specific Compose file now passes
`MARKET_DATA_SCHEDULE_ENABLED` and `PAPER_LOOP_SCHEDULE_ENABLED` (default `false`); `.env` adds
`MARKET_DATA_SCHEDULE_ENABLED=true`. Runtime after recreation: paper, live/execution/loop false,
`MARKET_DATA_SCHEDULE_ENABLED=true`, `PAPER_LOOP_SCHEDULE_ENABLED=false`, healthy, no schedule
events before 18:30 KST (expected). Rollback: restore both backups and recreate the server.

## Read-only console deployment (15:12–15:26 KST)

Commits through `2c05e17`. Evidence: `/home/jinsol/ai-trader-backups/console-deploy-20260929`
(source, `.env`, Compose, DB dump with `pg_restore --list` ok, before/after ledger snapshots).

- A 64-hex `CONSOLE_READ_TOKEN` was generated on the host into `.env` without printing it.
- Server Compose: `CONSOLE_READ_TOKEN` passthrough for `server`; new `web` service on the
  `ai-trader` network, published at `127.0.0.1:3201` (3100 is used by another host service).
- Before deploying, the server Dockerfile steps (copying only `apps/server`) were reproduced
  locally with the new lockfile: frozen install, build and prod deploy succeeded. On the host both
  images built; `server` recreated healthy (switches unchanged: collection schedule on, all
  order-capable switches off); `web` started healthy.
- Checks: direct console API without token 401 (4 routes); via the console proxy status, loop runs
  (the 9/29 commissioning run), 4 orders and the snapshot through 9/28 were returned; unknown proxy
  name 404, POST 405; neither token appears in the served page; the read token is rejected (401)
  by an order-token endpoint; `web` has no `ORDER_API_TOKEN`. Ledger hashes unchanged.
- Viewed through an SSH tunnel in a browser: PAPER banner and all four panels rendered, no
  browser console errors. Tunnel and the disposable test database were removed afterwards.

## Automatic paper trading enabled (2026-09-30 00:54 KST)

Owner-approved. Commit `6ca38f8` (morning confirmation, migration 0007) deployed first; evidence
`/home/jinsol/ai-trader-backups/autotrade-enable-20260930` (source, `.env`, Compose, DB dump with
`pg_restore --list` ok, before snapshot, reusable `check.sh`). `.env`: `PAPER_ORDER_EXECUTION_ENABLED`,
`PAPER_LOOP_ENABLED`, `PAPER_LOOP_SCHEDULE_ENABLED` set true; collection stays on; live false; kill
switch false; no task file. Server and web recreated healthy; anonymous console reads still 401.
Preparation at 00:54 KST correctly skipped with `snapshot_unconfirmed`.

The 9/29 bar kept changing overnight: close 273,000 (18:30), 273,500 (18:45 manual pull),
275,000 (23:49 re-collection after a restart). Likely after-market (NXT) prices in the KIS daily
series; unverified. Only the 08:00–08:50 KST morning re-collection is trusted for trading.

Rollback: set the three switches back to false (or restore `env.before`) and recreate `server`.

## 2026-09-30 session and owner control deployment

- 08:00 KST morning re-collection saved a revised 9/29 bar (close 272,500; earlier pulls 273,000 /
  273,500 / 275,000). 09:05 tick `loop-20260930-96c1f843fb27` completed with `NO_ENTRY`
  (EMA20 264,942 < EMA60 270,141, trend mixed); no order. No warnings or errors in logs.
- The agent's local 08:20/09:25/15:35 background checks did not run (the local session stopped);
  results were read at 10:23 KST instead.
- 10:40 KST: commit `1acda99` deployed (migration 0008). Evidence:
  `/home/jinsol/ai-trader-backups/controls-deploy-20260930` (backups, DB dump, read-only ledger
  snapshots before/after equal). Environment switches unchanged (all on, live off). As designed the
  schedule now reports `paper_loop_paused` until the owner resumes in the console. Anonymous
  control GET/POST 401, cross-origin POST 403, direct API POST 401.

## Universe collection and news archive deployment (2026-09-30 11:25 KST)

Commit `954d0e1` (migration 0009) deployed; evidence `/home/jinsol/ai-trader-backups/news-deploy-20260930`
(backups, DB dump ok, read-only ledger snapshots equal). Server Compose now passes the Naver and news
settings. Universe collection (54 symbols) starts with the 18:30 KST phase.

Naver credentials were copied from the owner's local repository `.env` (git-ignored) to the server
`.env` over SSH without printing them. A single budgeted probe returned HTTP 401 (authentication
failed); the call is counted (`naver-news` 1/1,000 today). `NEWS_SCHEDULE_ENABLED` stays false
until the owner corrects the credentials; no further Naver calls are made.

## Order-free universe plan enabled (2026-09-30 11:48 KST)

Commit `a132751` deployed; evidence `/home/jinsol/ai-trader-backups/plan-deploy-20260930`.
`UNIVERSE_PLAN_SCHEDULE_ENABLED=true` (server `.env` and Compose). The first plan
`plan-20260930-ace8d0453c3e` scanned 1 symbol and excluded 53: only `005930` had a snapshot
confirmed this morning because universe collection starts at 18:30 KST today. Orders, executions,
fills and loop runs unchanged; strategy_runs 1 → 2. The owner toggle currently reports
`paper_loop_paused`. The first full 54-symbol plan is expected on 2026-10-01 09:05 KST.

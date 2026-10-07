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

## News archive enabled via NAVER API Hub (2026-09-30 12:13 KST)

Root cause of the earlier 401 (`024 NID AUTH Result Invalid`): the owner's key pair belongs to
NCP NAVER API Hub (`NAVER_SCH_NEWS`), whose endpoint is `naverapihub.apigw.ntruss.com/search/v1/news`
with `X-NCP-APIGW-API-KEY-ID`/`X-NCP-APIGW-API-KEY`; the adapter had called developers.naver.com.
One budgeted probe to the API Hub returned 200. Commit with the corrected adapter deployed
(evidence `/home/jinsol/ai-trader-backups/ncp-news-deploy-20260930`); `NEWS_SCHEDULE_ENABLED=true`.
First run: 54 calls, 1,080 items for 54 symbols, 0 failures. Usage today: `naver-api-hub-news`
55/1,000 (probe + run), month 55/20,000; the two earlier developers.naver.com calls are recorded
separately as `naver-news`.

## Momentum plans, loss cooldown and corporate-action guard deployed (2026-09-30 14:51 / 15:02 KST)

Commits through `34917e6` (evidence `/home/jinsol/ai-trader-backups/momentum-deploy-20260930`, DB dump
ok; orders/executions/fills/loop runs unchanged). After the 14:51 restart the momentum plan failed on
a KIS balance TIMEOUT (first KIS call after restart) and the day's news was collected a second time
(usage 55 → 109). Fix `e2716d1..` / schedule-fix commit deployed at 15:02 (evidence
`/home/jinsol/ai-trader-backups/schedule-fix-20260930`): failed plan runners retry up to three times,
and news collection stops when persisted usage already covers the day (`news_already_collected`,
usage stayed 109). The 15:02 restart was after the 09:05–15:00 plan window, so the first
momentum plan will be on 2026-10-01.

## Momentum paper execution enabled (2026-09-30 15:45 KST)

Commits through `21675be` (decision 0014); evidence `/home/jinsol/ai-trader-backups/momentum-exec-20260930`
(backups, DB dump ok; read-only ledger snapshot before/after equal). `.env`: `MOMENTUM_EXECUTION_ENABLED=true`,
`PAPER_LOOP_SCHEDULE_ENABLED=false` (EMA 005930 automatic ticks off; one automated strategy per account).
Server Compose passes the new flag. Runtime: paper, live false, execution true, plan schedule true,
momentum execution true. Orders are sent only while the owner's console toggle is on. First entries
follow the first session of an ISO week (2026-10-06 close → 2026-10-07 orders).

## AI news screening enabled, record-only (2026-09-30 16:29 KST)

Commit `598d413` (decision 0015, migration 0010); evidence `/home/jinsol/ai-trader-backups/ai-screen-deploy-20260930`
(backups, DB dump ok, read-only ledger snapshots equal). The Anthropic key was copied from the owner's
git-ignored local `.env` without printing it and validated with a free models-list call (200).
`.env`: `NEWS_ANALYSIS_ENABLED=true`; model `claude-opus-5-5`; budgets $0.50/day, $6.50/month.
Screening targets momentum BUY candidates and holdings; with no holdings and no rebalance until the
2026-10-06 close, the first model calls are expected on 2026-10-07. Measurement calls today: 15
(≈ $0.19) from the operator workstation, outside the server budget ledger.

## Momentum daily rebalance deployed (2026-10-01 10:43 KST)

Commit `b43c08d` (decision 0016); evidence `/home/jinsol/ai-trader-backups/daily-rebalance-20261001`
(backups, DB dump ok; read-only ledger snapshots equal except the capture time). Server image rebuilt
and restarted; health `paper`, database connected. Today's plan was already saved under the weekly
cadence (cached by run key), so the first daily-cadence plan is 2026-10-02: entries and rank exits
are evaluated at every session close from then on. `.env` unchanged.

## Incident: two PostgreSQL servers on one volume (2026-10-01 10:42–11:14 KST)

Cause: the 10:41 restart used `docker compose -p ai-trader-app up -d server` without `--no-deps`.
The app Compose file's `db` service mounts the same external volume as the live database
`ai-trader-db` (project `ai-trader`), so `ai-trader-app-db-1` started on the same data directory
and answered the shared `db` alias. The app used it for 32 minutes; only migration 0011 was written
there. No orders were affected (no holdings, no orders scheduled).

Response (owner approved): server stopped, duplicate killed and removed; a logical dump of
`ai-trader-db` was byte-identical in content to the clean 10:30 dump; the volume was copied to
`ai-trader_postgres_incident_20261001`, reinitialized and restored from that dump (restore verified
identical), migration 0011 applied, server started with `--no-deps`. Evidence:
`/home/jinsol/ai-trader-backups/db-incident-20261001`.

Prevention: on the server, the app Compose `db` service is now behind the `standalone-db` profile and
the server's dependency on it is `required: false`. **Always pass `--no-deps` to `up` and `run` for
this deployment.** Back up and inspect `ai-trader-db` (the live database), not an app-project container.

## Minute bar archive enabled (2026-10-01 11:20 KST)

Commit `82a5c94` (decision 0017, migration 0011); evidence `/home/jinsol/ai-trader-backups/minute-bars-20261001`.
`.env`: `MINUTE_BARS_SCHEDULE_ENABLED=true`; server Compose passes the flag. First collection
expected today from 15:40 KST (54 symbols, about 750 KIS quote calls). Data only.

## Bearer check refactor deployed (2026-10-05 19:33 KST)

Commit `f016f5c` (shared `hasBearerToken`, no behavior change; one-off `measureNewsAssessor` script
removed). Evidence `/home/jinsol/ai-trader-backups/bearer-refactor-20261005` (source before, `.env`,
custom-format DB dump, update package SHA-256 `98b5d24e0f29…`). The six replaced files matched `4af9f74`
on the server before extraction. Image built; `up -d --no-deps server`; healthy. Server Compose and `.env`
unchanged. Console, loop tick, collect, schedule, orders and portfolio return 401 with no or a wrong
token; the console read token returns 200 (paper, live false). Only `ai-trader-db` serves the volume.

Finding (not changed): the momentum plans of 10/01 and 10/02 marked all 54 symbols
`INSUFFICIENT_HISTORY`. Stored daily snapshots hold 100 bars (one KIS `FHKST03010100` page), while
momentum needs `max(lookback, trendMa) + 1 = 121`. Momentum has therefore sent no orders, and AI news
screening has made no assessments (no candidates). Fixing this needs multi-page history collection and
a separate approval.

## Momentum history fix deployed (2026-10-05 20:33 KST)

Commit `fd2b880` (paged KIS daily history, calendar `krx-2026-v2` from 2026-01-02). Evidence
`/home/jinsol/ai-trader-backups/momentum-history-20261005` (source before, `.env`, DB dump, update package
SHA-256 `f932e85e8693…`); the three replaced files matched `01f5f08` on the server. Image built;
`up -d --no-deps server`; healthy; `.env` and Compose unchanged.

Verification: the collect endpoint archived 005930 through 20261002 with **184 bars** (two KIS pages),
calendar-aligned, version `krx-2026-v2`. Its 10/02 bar matches the 10/02 18:30 snapshot except volume
(11,286,561 → 11,501,250), recorded in `revisedDates`; the 18:30 collection evidently preceded KIS's final
after-hours volume. Prices are identical.

Expected on 2026-10-06: the 08:00 collection archives about 184 bars for each universe symbol (two KIS
calls per symbol), and the 09:05 momentum plan evaluates instead of `INSUFFICIENT_HISTORY`. With
`MOMENTUM_EXECUTION_ENABLED=true`, approved entries are sent as paper orders through the Risk Engine
(at most 5 positions, 9% allocation each); AI news screening records assessments for the candidates.

## First momentum session with full history (2026-10-06)

- 08:00 KST: all 54 universe snapshots through 20261002 collected and confirmed (up to 184 bars).
- 09:05 KST: `plan-momentum-20261006-ba75b9c33b40` evaluated all 54 symbols; no `INSUFFICIENT_HISTORY`.
  Entries: 066570 (rank 1), 034730 (rank 3), 018260 (rank 4). Ranks 0 (009150, close 1,581,000) and 2
  (000660, close 1,841,000) were `SIZE_UNAVAILABLE`: one share exceeds the 9% allocation of equity
  (KRW 10,017,291 → about 901,556). With this account size such symbols will keep being skipped.
- Paper orders, all risk-approved and filled: 066570 BUY 4 (KRW 919,000), 034730 BUY 1 (579,000),
  018260 BUY 4 (880,000; first `SUBMITTED` with no fill, filled on reconciliation about 30 s later).
  About 24% of equity invested.
- AI news screening recorded its first assessments (claude-opus-5-5): 066570 clear, 034730 caution,
  018260 clear. Record-only, so the caution did not block the order.

## Take-profit dry run enabled (2026-10-06 10:44 KST)

Commit `ca2ade7` (decision 0018, migration 0012). Evidence `/home/jinsol/ai-trader-backups/take-profit-dry-run-20261006`
(source, `.env`, Compose, DB dump; update package SHA-256 `5a49efa14af4…`); the six modified files matched
`fd2b880` on the server. Server Compose gained the `INTRADAY_TAKE_PROFIT_DRY_RUN_ENABLED` passthrough and `.env`
sets it to `true` (applied by the owner). Image built, migration 0012 applied (`intraday_signals` empty),
`up -d --no-deps server`, healthy; execution true, live false.

The mid-session restart replayed the day: `session_plan_saved` twice (still 2 runs for 20261006),
`momentum_execution_done` with no new order, `news_screen_done` with no new assessment (still 3). No
`take_profit_watch_failed` or error-level log in the first 8 minutes. The watch logs only crossings and
failures, so a quiet log is the expected state while no holding is 30% up.

## DART disclosure archive enabled (2026-10-06 15:57 KST)

Commit `5eecf81` (decision 0019, migration 0013). Evidence `/home/jinsol/ai-trader-backups/dart-disclosures-20261006`
(source, `.env`, Compose, DB dump; update package SHA-256 `6a99bb3c35dd…`); the six modified files matched `ca2ade7`.
The owner added `DART_API_KEY` (copied from the local `.env` without display) and `DISCLOSURE_SCHEDULE_ENABLED=true`
to the server `.env`, and the two Compose passthrough lines. Image built, migration 0013 applied, `up -d --no-deps
server`, healthy; key present in the container, live false.

Manual run inside the container with the production collector, caps and quota: 37 calls scanned 3,668 filings of
2026-09-29..10-06 and saved 93 for 43 universe symbols; an immediate repeat saved 0 (insert-only). Quota `opendart`
74 of 300 for the day. No error-level log. First scheduled run: 2026-10-07 08:15 KST.

## Console insights tab deployed (2026-10-06)

Commit `3470e4f`. Evidence `/home/jinsol/ai-trader-backups/console-insights-20261006` (source, `.env`, Compose; update
package SHA-256 `116aab81ad06…`); the nine replaced files matched `5eecf81`. No migration. Server and web images
built; `up -d --no-deps` for server, then web; both healthy. `/api/v1/me/console/insights` and the web proxy return
401 without a session; `/login` 200.

The production query (run read-only inside the server container) returned the 20261006 momentum ranking (54 rows),
daily coverage 54 symbols × 184 bars through 20261002, minute coverage 54 × 391 for 20261006, 40 recent filings and no
take-profit signal. At KRW 500,000 (budget KRW 45,000 per position) 8 universe symbols are buyable (HMM, 우리금융지주,
삼성중공업, 한국전력, 기업은행, HLB, 카카오, 카카오뱅크); none of today's top five is among them. The tab itself was not
inspected in a browser.

## Virtual day trading enabled (2026-10-07)

Commit `4ca39f9` (decision 0020, migration 0014) deployed 11:09 KST with the owner adding `SHADOW_DAY_TRADING_ENABLED=true`
and its Compose passthrough; evidence `/home/jinsol/ai-trader-backups/shadow-day-trading-20261007`. First watchlist 11:13
(97 of 100 quoted), first virtual buys 11:14 (069540, 490470, 256840).

The separate KIS session caused EGW00201 (per-second limit) rejections on both sides: 3 virtual and 2 production
take-profit reads at 1.5 s; 6 and 3 after `f143256` (2.5 s pacing and a 09:04–09:10 quiet window). `8ed9a49` routes
virtual quotes through the production session's single FIFO gate (1.5 s); deployed 11:53. From then to 12:02: 0 rejections,
100 of 100 quoted. Virtual fills so far: 3 entries 11:14, 069540 stop and 043260 entry 11:43.

## Take-profit thresholds +5% / +10% / +30% (2026-10-07 12:29 KST)

Commit `881083a` (migration 0015). Evidence `/home/jinsol/ai-trader-backups/take-profit-thresholds-20261007`; replaced
files matched `b13838d`. Server and web rebuilt, migration applied (check now allows TAKE_PROFIT_5/10/30), both healthy,
no EGW00201 in the first minutes. No crossing recorded yet (S-Oil +4.64% at 12:11).

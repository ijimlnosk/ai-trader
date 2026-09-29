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
confirm the prepared input. Phase B scheduling is not started.

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

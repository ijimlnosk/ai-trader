# Paper loop disabled deployment — 2026-09-29

## Result

The bounded paper loop (Phase 7) is deployed to `jinsol@sol-server`, Compose project
`ai-trader-app`, with every execution switch off. It has not been commissioned: no loop claim,
order or broker submission was made. Runtime stayed `BROKER_MODE=paper`,
`LIVE_TRADING_ENABLED=false`, `PAPER_ORDER_EXECUTION_ENABLED=false`, `PAPER_LOOP_ENABLED=false`,
kill switch unchanged, and no `PAPER_LOOP_TASK_FILE` configured.

Deployed source is the uncommitted working tree on top of `98267bb`. All runtime files
(`apps/server`, `packages`) matched the local tree by SHA-256; only test files (not shipped) and the
server's preserved `docker-compose.yml` differ.

## Deployment (11:43–12:03 KST)

Private evidence: `/home/jinsol/ai-trader-backups/paper-loop-deploy-20260929`.

- Pre-deploy source archive and custom-format DB dump `database-before.dump`. Rechecked at
  12:30 KST: `pg_restore --list` succeeds (archive structure only, not a full restore).
- `docker compose -p ai-trader-app build server` succeeded (`build.log`).
- Compiled migration applied `0004_paper_loop_claims.sql` (`migration.log`).
- `up -d --no-deps server` recreated only the application service.
- Smoke (`smoke.json`, 12:03 KST): unauthenticated tick 401, authenticated tick 503
  `loop_disabled`, and the Phase 5 dry-run replay (`paper-dry-run-20260929-2ce421f27807`) returned
  200 deep-equal to the stored record.
- Read-only snapshots (`before.json`, `after.json`): orders/executions/order_fills 3/3/3 and
  strategy_runs 1, full-row SHA-256 unchanged; `paper_loop_runs` created with 0 rows.

## Restart check (12:30–12:31 KST)

`up -d --no-deps --force-recreate server` with unchanged configuration. Health became `healthy`;
`/health` reported database connected and paper mode. Environment switches remained off.
The same smoke passed again (`restart-smoke.json`), and `restart-before.json` /
`restart-after.json` match the deploy snapshots exactly (same counts and hashes, 0 loop rows).

This proves disabled startup, migration persistence and dry-run parity across restart. It does not
exercise recovery of a real `CLAIMED`/`TRACKING` run, because none can exist while disabled; that
behavior is covered only by the isolated PostgreSQL tests recorded in the loop plan.

## Not done

- Commissioning was done separately; see [commissioning](PAPER_LOOP_COMMISSION_2026-09-29.md).
- The disposable test database container `ai-trader-loop-test-20260929` is still running on the
  server; it is not the operational DB and can be removed once no longer needed.

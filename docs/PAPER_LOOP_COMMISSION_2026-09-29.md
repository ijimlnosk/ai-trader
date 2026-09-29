# Paper loop commissioning — 2026-09-29

## Result

Phase 7 commissioning passed at 12:41 KST on `sol-server` (Compose project `ai-trader-app`).
One manual tick of the bounded paper loop ran Strategy → Risk → Execution → KIS paper and reached
`COMPLETE` in a single tick. The strategy-generated SELL of one `005930` share filled at KRW 272,500.
Loop and paper execution were enabled only from 12:40:23 to 12:43:41 KST and are off again.

This is a strategy-generated fill, not a forced signal: the signal (`TREND_EXIT`, SELL 1) matches the
Phase 5 dry run for the same dataset. Sizing, risk policy and kill switch were unchanged.

Private evidence: `/home/jinsol/ai-trader-backups/paper-loop-commission-20260929`.

## Pre-checks (12:38–12:39 KST)

- Runtime `BROKER_MODE=paper`, live false, paper execution false, loop false, kill switch false.
- `/health` ok with DB connected; broker status `configured=true`, `reachable=true`.
- Quote `005930` KRW 272,500; portfolio one share, average price 263,375.
- Ledger BUY 2 − SELL 1 = 1 share, matching KIS; 3 orders all filled, no unresolved order,
  0 `paper_loop_runs`. Snapshot hashes equal to the disabled-deployment snapshots.

## Tick

- Input: runKey `loop-commission-20260929`, session `20260929`, the Phase 5 dataset
  (SHA-256 `2ce421f27807fae0ec69592a10dcb79eeaf9ee02d322fa41f05b6eb6c21926a4`, last completed bar
  9/28), calendar = its 100 historical sessions + `20260929`. Request file SHA-256
  `8969275a68eee7a450dd26a6c1cb4bd7de40eb874b3b6b83cceadbaaaa9bc43f`.
- Enabled by setting `PAPER_ORDER_EXECUTION_ENABLED=true` and adding `PAPER_LOOP_ENABLED=true` in
  the server `.env`, then `up -d --no-deps server`. No task file (manual tick only).
- Strategy: `TREND_EXIT`, SELL 1 @ estimated 270,000. Risk approved 1 with no reasons; context cash
  9,745,970, equity 10,018,115, 1 open position, daily P/L 0, streak 0, kill switch false.
- Order `a73b2a6c-f266-4176-80c7-f6aa2ecb3c26`, MARKET SELL 1, KIS order `23139`, created
  03:41:35Z, FILLED 1 / KRW 272,500, positions synchronized 03:41:42Z.
- Run `68b2c4ab-7d78-45ad-ac79-7ea4f1bd668c`: `COMPLETE`, version 2, no reason, order key
  `f61136ee-f0a5-8f7f-af58-a3d014306427` (identical to the Phase 5 dry-run key).

## Post-checks (12:43–12:45 KST, switches off)

- `.env` restored byte-for-byte from backup; Compose file unchanged; runtime all switches false.
- KIS portfolio: no positions. Ledger positions: none.
- Production ledger reader for 20260929: daily realized P/L `9125`
  (`272500 − 263375` moving-average cost), consecutive losses `0`.
- Every order's filled quantity/amount equals its execution sums. Orders/executions/fills 3 → 4 each.
- Unchanged tick replayed with switches off: 200, stored `COMPLETE` record with KIS `23139`
  `FILLED`; snapshots before and after the replay identical (no new order or run).
- Final hashes: orders `7c29cfcf…`, executions `106b0bf2…`, order_fills `decc8086…`,
  strategy_runs unchanged `f4eaa085…`, 1 loop run. Health ok. No error-level logs.

Gross ledger P/L excludes fees/taxes. Broker total evaluation moved from 10,017,615 (12:38) to
10,017,291 after the sale; do not equate gross ledger P/L with net return.

## Operator notes

- A malformed helper command at 12:40 KST briefly invoked the tick script without its import; it
  threw before any request (verified: 0 loop rows, 3 orders, no loop log entries).
- The first tick's saved HTTP response (`tick-1.json`) is truncated by a shell pipe. The DB state
  (`state-after-tick-1.json`) and the full disabled replay (`tick-replay.json`) are the evidence.

## Not covered

TRACKING across multiple ticks, the fixed-task trigger, crash recovery and HALTED paths were not
exercised live (the order filled before the first tick returned). They remain covered by the
isolated PostgreSQL tests only. Multi-symbol, data ingestion, holiday calendar, AI and live trading
remain out of scope.

# Scheduler production check — 2026-09-28

## Result

At 14:46 KST, the production scheduler rejected two identical authenticated requests with HTTP 503
`order_context_unavailable`. The supplied session date was `20260928`, and the check occurred inside
the application's order window. The latest completed KIS daily bar was `20260923`, approximately
119.27 hours old. The strategy freshness ceiling is 96 hours, so this dataset cannot run today.

This is safe rejection evidence, not a successful scheduler run or replay-idempotency proof.
Phase 5 remains open and Phase 7 remains gated. No clock, freshness limit, risk policy or execution
configuration was changed. Paper execution and live trading both remained disabled.

## Data and provenance

Read the existing deployed KIS session client with its 1.6-second request pacing and paper credentials.
Only the historical quotation GET was used, apart from normal authentication. No broker order was
requested. Parameters follow the [official KIS example](https://github.com/koreainvestment/open-trading-api/blob/main/examples_llm/domestic_stock/inquire_daily_itemchartprice/inquire_daily_itemchartprice.py):

- Endpoint: `/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice`, TR `FHKST03010100`.
- Symbol `005930`, KRX market `J`, daily period `D`, raw price flag `1`.
- Requested dates: `20260101` through `20260927`, explicitly excluding today's unfinished candle.
- Returned 100 completed bars, `20260429` through `20260923`; the existing dataset schema accepted
  mapped OHLCV in ascending date order. No candles were fabricated or shifted to a newer date.
- Declared dataset sessions are the observed KIS bar dates. Completeness against an independently
  sourced exchange calendar and corporate-action history was not certified by this diagnostic.

Private server evidence directory:
`/home/jinsol/ai-trader-backups/scheduler-check-20260928T054623Z`.
It retains the raw provider response, normalized dataset, exact request, responses, before/after
DB snapshots and diagnostic helper. Run key: `paper-dry-run-20260928-2c3677e1dcd4`.

## Persistence and checks

Before and after both requests: orders=3, executions=3, fill snapshots=3, strategy_runs=0.
Persisted order IDs, statuses, fill totals and synchronization timestamps remained unchanged.
The first request did not persist a run, so the second request was another rejection rather than
a replay of a saved result. A changed-payload conflict check was not attempted without a saved run.

Focused scheduler and strategy tests passed: 8 tests across 2 files, using the installed Vitest
binary (`./node_modules/.bin/vitest run apps/server/src/application/scheduler/scheduler.test.ts
apps/server/src/application/strategy/strategy.test.ts`). `pnpm test` could not start because pnpm
is absent from this shell's PATH; no package was installed. No product code changed, so full
build/typecheck/lint were not rerun. Documentation whitespace checks passed.

## Next permitted verification

After-close follow-up: [9/28 preparation](SCHEDULER_PREP_2026-09-28.md) now records fresh data,
calendar comparison, archived requests and a syntax-checked manual verifier for 9/29. No successful
production scheduler run has occurred as part of that preparation.

### 15:23 KST follow-up

Resumed after the application's 15:20 cutoff. Read-only production checks confirmed the server
container was healthy, `/health` reported `database=connected` and `tradingMode=paper`, and runtime
flags remained `BROKER_MODE=paper`, `LIVE_TRADING_ENABLED=false` and
`PAPER_ORDER_EXECUTION_ENABLED=false`. No scheduler request, broker order or configuration change
was made in this follow-up. Today's bar was not collected or represented as completed. Phase 5
success/replay/conflict verification and Phase 7 execution wiring remain pending.

After a new completed close, refresh and archive the actual daily dataset. During the next declared
open session, verify its latest completed bar is within 96 hours; today's unfinished bar cannot
be used and today's post-close time is outside the scheduler window. Validate the expected session
calendar independently before treating the dataset as complete strategy input.

With execution still disabled: expect one persisted scheduler record and `order: null`; repeat the
identical key/payload and compare the complete returned record and unchanged counts. Then verify
that different data under the same key returns 409. Only after successful production evidence may
Phase 7 proceed. Holiday-aware freshness/calendar support is separate product work, not a bypass
to make this checkpoint pass.

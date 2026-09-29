# Next-session scheduler preparation — 2026-09-28

## Result

Prepared the Phase 5 order-free verification for the declared 2026-09-29 session. No scheduler
request or broker order was sent. No application source, deployment or runtime setting changed.
Production success/replay/conflict evidence remains outstanding; Phase 7 remains gated.

## Archived market data

At 15:50:47 KST, the deployed KIS session client fetched raw daily KRX (`J`) history for `005930`
using `FHKST03010100`, daily period `D`, raw-price flag `1`, and dates `20260101`–`20260928`.
The request used paper credentials and 1.6-second pacing; only quotation GET and authentication
were used. Runtime guards required paper mode, live false and paper execution false.

- Returned 100 bars: `20260430` through `20260928`.
- Latest regular-close bar: open 284500, high 285500, low 270000, close 270000 KRW;
  volume 20247374 shares. These are the provider values observed at collection time.
- Existing deployed `datasetSchema` accepted ordering, dates, OHLCV and session alignment.
- Latest close is 17.5 hours old at 2026-09-29 09:00 KST, below the unchanged 96-hour limit.
- Normalized JSON SHA-256: `74c5ea10497f88098e49ff8884ff03008f905cb04f84d5275bb8eacdfbacb3cd`.
- Prepared run key: `paper-dry-run-20260929-74c5ea10497f`.

Private archive: `/home/jinsol/ai-trader-backups/scheduler-prep-20260928-close`.
Files: `collect.mjs`, `evidence.json` (raw provider response and provenance), `dataset.json`,
`request.json`, `request-conflict.json`, `calendar.json`, and `verify.mjs`. Files are mode 0600.
The verifier was syntax-checked in the deployed container, but was not executed.

## Independent calendar cross-check

Generated weekdays from April 30 through September 28, excluding the following sourced closures:
May 1, May 5, May 25, June 3, July 17, August 17, September 24 and September 25.
All 100 expected dates match the KIS dates exactly: zero missing or unexpected dates.

Sources inspected on September 28:

- [Mirae Asset 2026 calendar, pp. 38–39](https://securities.miraeasset.com/bbs/download/2140126.pdf?attachmentId=2140126):
  May 5/25, August 17 and September 24/25. This November 2025 publication alone is insufficient;
  later closure notices supplement it.
- [Samsung Securities April schedule, p. 16](https://www.samsungpop.com/common.do?cmd=down&contentType=application%2Fpdf&fileName=4010%2F2026042417150531K_02_01.pdf&inlineYn=Y&saveKey=research.pdf): May 1 closure.
- [Samsung Securities June 3 closure notice](https://www.samsungpop.com/customer/guide.do?MenuSeqNo=23996&cmd=notice_view&menuNo=020306).
- [Samsung Securities July 17 closure notice](https://www.samsungpop.com/customer/guide.do?MenuSeqNo=24145&cmd=notice_view&menuNo=020306).

September 29 is the next expected weekday session under these publications. This is a manual
calendar cross-check, not a live KRX calendar integration, certification of corporate-action
history, or guarantee against later provider revisions. Reconfirm session operation and archived
close validity before sending the request; archive any revised dataset under a new preparation
directory and recompute its digest before commissioning. Never change a saved run's input.

## Next-session procedure

1. Confirm the declared session is open, 09:00 <= KST time < 15:20, server healthy, account exclusive,
   and runtime paper/live false/execution false. Check for changed closure notices or revised data.
2. Inspect the retained input/digest and private verifier before use. Do not invoke the earlier
   14:46 helper: it collects different data and immediately calls the scheduler.
3. Run the prepared verifier manually from the deployment directory, preserving its complete
   stdout in a new private evidence file and retaining its exit status. Example on the server:

   ```sh
   cd ~/ai-trader-app
   umask 077
   set -C
   docker compose -p ai-trader-app exec -T server node --input-type=module \
     < /home/jinsol/ai-trader-backups/scheduler-prep-20260928-close/verify.mjs \
     > /home/jinsol/ai-trader-backups/scheduler-prep-20260928-close/verification.json
   ```

4. Require first 200 with `result.order: null`, identical complete 200 replay, then 409
   `idempotency_conflict` for changed attribution under the same key. Require exactly one added
   `strategy_runs` row with the expected digest and unchanged counts/full-row hashes of orders,
   executions and fills. The verifier checks these conditions and reports `passed`.
5. A failed/ambiguous call is not success. Inspect DB and retained evidence before recovery; do not
   generate a new key to conceal a partial run. The verifier refuses an already-persisted key.
   Update the Phase 5 evidence only after inspecting results. No automatic job has been installed.

## Local validation

Found the existing pnpm 10.17.1 executable under
`~/Library/pnpm/package-manager-store/v11/links/@pnpm/exe/10.17.1/0874535f32ba4ab18e260d0cf416f2aa8ede5d1074b36999f8ae420eff96da43/bin`.
Used that directory in command-local PATH; no installation or shell configuration change.

- `pnpm test`: 410 passed; 10 PostgreSQL integration tests skipped because no explicit disposable
  `ORDER_TEST_DATABASE_URL` was supplied. No operational database was used for automated tests.
- `pnpm lint`, `pnpm typecheck`, `pnpm build`: passed.
- Private verifier: deployed Node syntax check passed; production behavior awaits next session.

Preparation does not prove a production scheduler run, a strategy-generated fill, or an operating
paper loop. The earlier rejection evidence remains in [the scheduler check](SCHEDULER_CHECK_2026-09-28.md).

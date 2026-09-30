# 0011 — Reviewed universe, news archive and hard external-API budgets

Date: 2026-09-30. Status: accepted.

## Universe

`domain/market/universe.ts` lists 54 liquid KOSPI/KOSDAQ names (`krx-liquid-2026-09-v1`). Every
code/name pair was verified against a KIS daily-chart response on 2026-09-30; all had a 20-session
average turnover above KRW 13.3bn. The paper KIS account cannot rank the market (volume ranking and
news endpoints return `provider_unavailable`), so the universe is reviewed data, updated monthly
with a new version. The daily schedule archives and re-confirms bars for all of them (≈ 90 s per
phase through the 1.5 s paced client); failed symbols alone are retried, at most three times.
The paper loop still trades `005930` only until multi-symbol decisions are implemented and tested.

## News and budget

Naver news search (owner-provided credentials in the server `.env`) archives up to 20 newest
headlines per universe symbol once per session day after 08:10 KST, query `<name> 주가`.
Items are display-only; no decision uses them yet.

The provider allows 25,000 calls/day and 775,000/month. The server enforces self-imposed caps
(defaults 1,000/day and 20,000/month; configuration above 20,000/600,000 is rejected at startup).
Each call is reserved beforehand in `external_api_usage` (migration 0009) inside a transaction that
locks both the Seoul-day and month rows; a refusal stops the run before any request. Failed calls
count. Usage survives restarts and is shown in the console. Expected use is ≈ 54 calls/day.
Other applications sharing the same credentials are outside this budget and must be accounted for
by lowering the caps.

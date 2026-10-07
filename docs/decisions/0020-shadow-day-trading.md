# 0020 — Virtual intraday day trading for a KRW 500,000 account

Date: 2026-10-07. Status: accepted (owner request: build it, accumulate paper data, change on evidence). Order-free.

- Rule set `day-v1` (`domain/strategy/dayTrading.ts`): at 09:01 KST sweep the 100-symbol low-price universe
  (`krx-lowprice-2026-10-v1`) and keep up to 12 names up 1–8% on the day, by traded value. From 09:10, buy a
  watchlist name at a new high within that band into one of 3 slots (cash ÷ free slots). Sell at +5%, or once +3%
  was reached and the price is 1.5% below the high since entry, or at −3%. At 15:15 sell winners; hold a loser
  only if it is above its first price of the day. After a sale, re-buy 2% below it (at most 4 buys per symbol/day).
  No entries after 15:00; nothing after 15:20.
- Virtual fills on live quotes (≤ 10 s old) with commission 2 bp per side, sell tax 20 bp and slippage 10 bp; whole
  KRW and shares. Every fill is stored insert-only in `shadow_trades` (migration 0014); cash and holdings are
  replayed from them, so restarts keep the ledger.
- No proposal, Risk Engine call or broker write. A separate KIS session (quotes only) keeps production quote and order
  calls from queueing behind it. Both sessions share the provider's per-second limit: after EGW00201 rejections on
  2026-10-07 (3 virtual, 2 production take-profit reads) the virtual session paces at 2.5 s and makes no calls from
  09:04 to 09:10, around the 09:05 momentum orders; a sweep reaching 09:04 stops with the quotes it has.
- `SHADOW_DAY_TRADING_ENABLED` (default false). The minute-bar archive now also covers the low-price universe
  (about 150 symbols, roughly 2,100 KIS calls each evening at 1.5 s).

Paper orders, rule changes and any live use need recorded results and separate approval.

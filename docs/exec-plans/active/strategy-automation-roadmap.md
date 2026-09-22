# Strategy automation roadmap

## Phase status

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | MarketSnapshot + indicator engine | Complete |
| 2 | Deterministic Strategy Engine v1 | Complete |
| 3 | Offline next-open backtest engine | Complete |
| 4 | Strategy → deterministic Risk connection | Complete |
| 5 | Scheduler and trading-session coordination | In progress (dry-run boundary) |
| 6 | KIS paper BUY/SELL E2E during an open session | Pending next permitted session |
| 7 | Strategy → Risk → Execution paper loop | Blocked on Phases 5 and 6 |

## Completed foundation

Phase 1 owns validated daily OHLCV, EMA20/60, Wilder RSI14/ATR14, liquidity and volume screens.
Phase 2 produces deterministic `TradeProposal` values. Phase 3 evaluates next-session-open fills
with an isolated ledger and exact monetary costs. Phase 4 rechecks proposals through the production
Risk Engine and paper account ledger before any execution path.

## Next phase: scheduler and session coordination

Implement a scheduler boundary that wakes only for declared KRX sessions and coordinates these
read-only steps first:

1. load an explicit, validated market dataset or daily snapshot;
2. verify the Seoul session and data freshness;
3. evaluate the strategy and risk context;
4. persist an idempotent run record and report proposals/decisions.

The first implementation must not submit orders, enable paper execution, infer holidays, or invent
missing candles. It needs an injected clock, explicit session calendar, bounded retries for no
broker writes, run idempotency, and a dry-run CLI or endpoint. Execution should be added only after
Phase 6 confirms the real paper account round trip.

The first dry-run boundary is now `POST /api/v1/strategy/schedule`. It requires a caller-supplied
session date, uses an injected-clock session check, evaluates strategy and risk without an execution
symbol, and replays an idempotent run record. Production composition persists records in the
`strategy_runs` PostgreSQL table; tests use an in-memory adapter.

## Phase 6 gate

During a permitted 09:00–15:20 Asia/Seoul session, with the account exclusive and execution opt-in
temporary: baseline one-share holdings, submit one paper BUY with a retained idempotency key,
reconcile until KIS holdings and DB agree, submit one paper SELL, reconcile again, and verify the
moving-average ledger P/L and next risk context. Disable execution after the checkpoint. Any timeout
or ambiguous result remains unresolved and must not be retried under a new key.

## Phase 7 gate

Only after Phase 5 dry-run idempotency and Phase 6 paper BUY/SELL evidence pass may a scheduler call
the existing Strategy → Risk → Execution application path. The first loop remains paper-only,
single-symbol or explicit-universe, kill-switchable, auditable and disabled by default.

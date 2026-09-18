# 0007 — Shared deterministic strategy with isolated net backtest ledger

Status: accepted, 2026-09-18.

Use one long-only daily EMA crossover strategy for paper evaluation and offline replay. Explicit
raw OHLCV datasets and expected sessions protect the historical-data boundary without introducing
a speculative provider framework. Strategy sizing proposes quantities; the existing deterministic
Risk Engine remains the only source of risk approval. No strategy receives a broker reference.

Paper strategy submission is explicit, protected by existing order authorization and disabled by
default. Persist selected-symbol input history and sizing state in existing request JSONB for replay.
Derive a stable UUIDv8 from strategy version, symbol and evaluated bar, excluding config and side so
re-evaluation cannot become an accidental new order. Existing repository uniqueness and account
serialization apply unchanged. No automatic retry or daily scheduler is introduced.

Backtests cannot truthfully reproduce KIS fills from candles. Use a documented next-session-open
model and fresh deterministic risk evaluation with opening marks only. Store costs in a separate
net simulation ledger using the existing moving-average projection. Do not change production's
gross execution ledger or invent unavailable broker fee/tax fields. All amounts use fixed-scale
integers; only indicator calculations and display ratios use floating point.

Consequences: research is reproducible without credentials and strategy behavior matches paper
signal generation. Actual fills, timing and costs can differ. Current-universe survivorship bias,
corporate actions, authoritative calendars and historical ingestion remain explicit future work.
The initial conservative next-weekday paper freshness gate rejects signals spanning weekday holidays.
Parameters are starting assumptions, not optimized or profitability-validated settings.

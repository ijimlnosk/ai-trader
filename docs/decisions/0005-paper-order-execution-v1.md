# 0005 — Durable, single-flight human paper orders

Date: 2026-09-16. Status: accepted for the user-requested paper checkpoint.

## Context
The next checkpoint is a server-priced human proposal, deterministic risk approval, one real KIS
paper order, durable lookup and confirmation of broker holdings. AI/strategy and realized P/L
accounting are later phases. Broker submission and PostgreSQL cannot share a transaction.

## Decision
Write PREPARING and the idempotency key first, then the risk audit, then commit SUBMITTING before
calling KIS once. Preserve unknown outcomes and serialize unresolved orders per account with a
PostgreSQL unique partial index. Do not treat timeout as rejection or retry POST automatically.
An explicit reconciliation command reads cumulative fills and a fresh portfolio. Atomic snapshot
and absolute-position writes avoid adding a cumulative fill twice. Terminal holdings must match
before another order is admitted. Unknown receipts require operator-supplied, verified broker IDs.

MARKET only, whole shares, fresh server quote, no-margin buying power for BUY, sellable holdings for
SELL, regular-session window and explicit authenticated execution opt-in. Broker remains paper-only.
This checkpoint retains PAPER_RISK_V1_INITIAL_STATE for daily realized P/L and loss streak; it connects
the operational BUY kill switch and true buying power. This supersedes decision 0004's requirement
to finish the P/L ledger before any paper execution. It does not authorize live or autonomous trading.

## Consequences
Crash recovery favors blocking over accidental duplicate orders. A PREPARING crash or unresolved
submission without a verifiable broker ID requires manual investigation; there is no automatic unlock.
Use one operator and no simultaneous HTS/other-client orders during checkpoint verification.
Market fills can exceed quote-based estimates. Daily/streak loss limits do not yet use actual results.
Fill snapshots omit execution-level fee/tax accounting; realized P/L must be implemented before the
future strategy/AI automation phase. Defaults stay disabled and all automated broker tests use stubs.

The additive migration preserves legacy rows/columns, relaxes the unused mandatory price column
while preparation runs, adds execution fields/indexes and order_fills. Roll back application behavior
by disabling execution, not by deleting financial records or reversing the migration. Drain/reconcile
unresolved orders before switching binaries; retain a database backup before migration.

## Official API references
- [Cash orders and paper TR IDs](https://github.com/koreainvestment/open-trading-api/blob/main/examples_llm/domestic_stock/order_cash/order_cash.py)
- [No-margin buying power](https://github.com/koreainvestment/open-trading-api/blob/main/examples_llm/domestic_stock/inquire_psbl_order/inquire_psbl_order.py)
- [Daily fills and paper pagination](https://github.com/koreainvestment/open-trading-api/blob/main/examples_llm/domestic_stock/inquire_daily_ccld/inquire_daily_ccld.py)

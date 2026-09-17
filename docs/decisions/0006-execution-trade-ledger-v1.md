# 0006 — Execution & Trade Ledger v1

Date: 2026-09-17. Status: accepted for paper execution.
Supersedes the zero-history RiskContext assumptions in decisions 0004 and 0005.

## Decision

Reuse KIS cumulative order reconciliation. Store each positive cumulative change as an immutable
observed execution delta in the same transaction as order state, fill snapshot and broker position
mirror. Do not claim these deltas are exchange execution IDs or individual exchange timestamps.
Optimistic order versions and an order/cumulative-quantity unique index protect replay/concurrency.
Unfilled snapshots create no executions; quantity-only, amount-only and regressive changes fail closed.
UNKNOWN still requires an independently confirmed broker order ID and never triggers broker POST retry.

Project gross realized P/L with moving-average acquisition cost using BigInt fixed-scale money.
Allocate cost to disposed shares at eight decimals, retaining division residual for later disposal.
This makes all acquisition cost consumed on final liquidation. Projection is reproducible from the
stored observed deltas; historical polling granularity can affect sub-won residual allocation timing.
Do not use market price, unrealized P/L, or current broker average as a historical acquisition record.
Fees/taxes are not included: this phase is a gross execution ledger, not net settlement accounting.

Daily P/L follows KRX cash order date in Asia/Seoul, not observation date. Partial sales count immediately.
Consecutive losses aggregate each SELL order's realized P/L; BUY never resets, nonlosing SELL resets,
and streak survives midnight. Pending partial orders already block further submission, so provisional
streak changes cannot admit another trade while the remaining order is unresolved.

The production risk provider reads persisted ledger history for every evaluation and checks all open
quantities against a fresh broker portfolio. Missing/inconsistent data or absent acquisition basis
fails closed. The environment's actual kill switch is passed to both debug risk and execution;
existing SELL policy and explicit paper-only activation remain unchanged.

## Migration and limitations

Add executions without deleting/changing prior orders/snapshots. Backfill one marked aggregate event
per existing order with valid positive fills and broker identity/date; later reconciliation adds only
new increments. Legacy rows without account attribution are preserved but cannot be claimed as known
account history. Missing acquisitions require verified history repair before trading can resume.
No automatic external trade import, opening cost estimate, timer, strategy, AI, live orders or retry.

The ledger reader verifies cumulative completeness in one statement snapshot. Full-history projection
is intentionally simple for a private v1 account; materialized state is deferred until measured need.
`positions.realized_pnl` remains a legacy field; executions and their projection are the source of truth.
A dedicated account without outside trades/corporate actions is required. Quantity equality cannot
prove that an unobserved external round trip did not happen. Gross risk limits omit fees/taxes and
are not sufficient evidence of readiness for autonomous/live trading.

Rollback disables execution and preserves all records; old zero-history binaries must not execute.
Operational migration/backups follow the existing runbook and are never run against production by tests.

## Reference

[KIS official daily order-fill query and continuation sample](https://github.com/koreainvestment/open-trading-api/blob/main/examples_llm/domestic_stock/inquire_daily_ccld/inquire_daily_ccld.py)

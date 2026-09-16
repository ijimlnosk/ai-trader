# 0003 — Risk v1 requires trusted context and cannot authorize execution

Status: partially superseded by [0004](0004-paper-risk-context.md) for paper cash and initial-state wiring.
Exact arithmetic, fail-closed failures and no-execution boundaries remain accepted.

## Context

The existing KIS portfolio provides deposit cash and valuation P/L, not verified buying power,
daily realized P/L, loss streak or operational kill-switch state. Substituting zero losses or
assuming a disabled kill switch would produce unjustified approvals.

## Decision

Inject a RiskContextProvider at application composition. Until an authoritative provider exists,
the default provider returns null and evaluation rejects with INVALID_CONTEXT. HTTP clients cannot
provide context or policies. Provider exceptions produce a sanitized 503. No broker adapter or
portfolio field is changed to manufacture context.

Use bounded BigInt decimal arithmetic compatible with numeric(24,8), without a dependency or
rounding. Keep the domain evaluator pure and record full versioned policy, proposal, copied context,
decision and timestamps in an application result suitable for later persistence.

V1 checks incremental BUY exposure; all BUYs count as new symbols for the position cap. SELL skips
BUY halts to permit future liquidation but still validates inputs. Approval is an evaluation result,
not permission to execute. Holdings, tradable lot size, freshness and concurrency safeguards remain
future execution prerequisites. No order may bypass Risk Engine.

## Consequences

Debug evaluation is available and testable today, but default deployment cannot approve without
trusted context wiring. No fabricated risk state, real account calls in tests, persistence, or order
capabilities are added. Provider implementation and execution safeguards are separate future tasks.

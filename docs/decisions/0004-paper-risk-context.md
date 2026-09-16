# 0004 — Explicit portfolio-backed paper v1 risk context

Status: accepted. Supersedes decision 0003's default-null provider and prohibition on using
deposit cash for the paper v1 evaluation context.
The future paper-execution prerequisites below are superseded by [decision 0005](0005-paper-order-execution-v1.md)
for the explicitly limited human-operated paper checkpoint; debug evaluation semantics remain unchanged.

## Context

Production risk evaluation always rejected with INVALID_CONTEXT because bootstrap supplied no
provider. The current scope explicitly requests KIS portfolio-backed evaluation with initial paper
state while loss history and an operational kill-switch source do not yet exist.

## Decision

Production bootstrap uses createRuntimeApp to construct one KIS adapter, create the application
paper portfolio provider and inject it into createApp. createApp requires provider dependencies
and fails at construction if the risk provider is missing. Routes remain application-only.

Map portfolio.cash to risk cash, totalEvaluation to totalEquity and positions.length to the
open position count. Portfolio.cash remains deposit cash: its use as a risk cash proxy is explicit
and limited to this paper-only runtime. PAPER_RISK_V1_INITIAL_STATE supplies dailyRealizedPnl='0',
consecutiveLosses=0 and killSwitchEnabled=false on each evaluation. These values are not measured
history, fallback values after an error, or persisted operational state.

Validate consumed portfolio fields before constructing context. Invalid account data becomes
INVALID_CONTEXT; retrieval exceptions propagate to sanitized HTTP 503. Do not cache prior context
or replace failed portfolio reads with defaults. Reuse exact domain decimal validation.

## Consequences

Valid paper portfolios can produce risk approvals using unchanged policy. KIS authentication and
portfolio behavior remain shared with existing read endpoints. No DB persistence, order methods,
live mode or policy modifications are introduced. Realized losses, loss streak and an operational
kill switch are not monitored by this initial provider. Verified buying power and authoritative
risk state remain prerequisites for future execution; approval itself cannot authorize an order.

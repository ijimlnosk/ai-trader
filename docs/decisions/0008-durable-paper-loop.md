# 0008 — Durable single-symbol paper loop

Date: 2026-09-29. Status: accepted for implementation; production activation is separate.

The deployed dry-run scheduler persists only after evaluation and cannot safely become an
execution scheduler by adding an execution symbol. Re-evaluation after a fill can change the
proposal, and a crash can lose linkage after the broker accepted an order.

Add one separate account-scoped claim table. Atomically claim the strategy/version/symbol/bar
identity before evaluating. Retain the deterministic order key, full input/calendar provenance,
result and latest order snapshot. Uniqueness also prevents a second active claim for an account.
Claim losers never execute. Update claims optimistically without holding DB transactions over
network requests; existing order reservation remains the final order-level serialization guard.

Recover through the retained account-scoped order key, checking strategy input hash. Never infer
that no order was sent from an old timestamp. A claim without an identifiable order remains
blocked for investigation. Unknown transport states remain operator-owned. A two-minute deadline
and one reconciliation per tick bound polling; confirmed terminal order synchronization allows
completion even after opt-out. Complete records replay without re-evaluating changed holdings.

Both loop and execution opt-ins default false. The authenticated manual tick and optional fixed-file
same-process trigger share one use case and KIS session. A trigger runs one declared archived task;
no calendar guessing, ingestion, cross-process request pacing or automatic catch-up is introduced.
This trades unattended multi-day operation for a bounded and auditable commissioning surface.

The strategy and risk provider now share the single portfolio read from that evaluation. The
provider still validates it and compares holdings with the execution ledger. This resolves the
observed false mismatch between successive mark-to-market valuations without relaxing validation.
Actual order execution retains a separate fresh portfolio, quote and risk evaluation.

Migration 0004 is additive and does not modify legacy orders/fills/executions/dry runs. Rollback
retains claims and disables execution; older binaries must not execute while unresolved claims
exist because they do not consult this table. No automatic claim unlock is provided.

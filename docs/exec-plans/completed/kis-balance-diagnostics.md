# Goal
Align paper balance queries with the official all-balance sample and expose safe KIS error codes.
# Constraints
No orders or risk-policy changes. Never log msg1, account identifiers, credentials or tokens.
# Evidence and decisions
Official legacy/Sample01/kis_domstk.py uses INQR_DVSN=00 (all). Current examples_llm documents
02 as symbol-level and demonstrates 01; 02 is not proven invalid or the cause of the reported 503.
Use 00 per the requested all-balance preference; retain paper VTTC8434R and other verified parameters.
Add an injected infrastructure diagnostic sink wired to the runtime structured logger.
# Plan
- [x] Query alignment and safe non-zero rt_cd diagnostics
- [x] Parameter, logging, mapping and fail-closed regression tests
- [x] Document evidence and pass typecheck/lint/test/build
# Progress
Inspected session, adapter, runtime composition, tests and repository rules. Working tree initially clean.
Changed only INQR_DVSN to 00; preserved the rest of the verified query and paper TR ID.
Session emits a minimal sanitized event; production composition connects it to app.log.warn.
Documented official-source differences, parameter table and logging semantics in architecture.
# Validation
- pnpm typecheck, pnpm lint, pnpm test, pnpm build: passed.
- 259 tests passed across 13 files, including 20 new logging/sanitization cases.
- All query fields and VTTC8434R verified; existing portfolio mapping/continuation tests passed.
- Non-zero business/auth codes logged via production wiring; HTTP contracts remain generic.
- Secret-like/malformed/missing codes sanitized; no msg1, account, app key/secret or token exposure.
- Portfolio failures still block risk evaluation; successful mapping emits no rejection diagnostic.
- git diff --check: passed. No orders, policy changes, credentials or unrelated edits added.
# Remaining work
No implementation work remains. Deployment and real KIS verification were not performed.
The reported upstream 503 cause and resolution require observing the next real msgCode;
official support for 02 means its previous use alone is not proof of the root cause.

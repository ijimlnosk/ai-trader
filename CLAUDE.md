# CLAUDE.md — AI Trader

## Purpose

This file is the entry point for Claude working in this repository.

Keep this file short.

Detailed rules live in:

```text
.claude/rules/
```

Read only the rules relevant to the current task.

---

## Project

AI Trader is a private AI-assisted automated trading platform.

Primary stack:

```text
Monorepo
pnpm

Frontend
Next.js
TypeScript
TanStack Query
Zustand

Backend
Fastify
TypeScript
PostgreSQL
Drizzle

Trading
Broker adapters
Paper trading first

AI
Provider abstraction
Structured outputs
```

---

## Repository

```text
apps/
  web/
  server/

packages/
  contracts/
  config/

docs/
  ARCHITECTURE.md
  decisions/
  exec-plans/

.claude/rules/
```

---

## Required Rules

Always read:

```text
.claude/rules/00-project.md
.claude/rules/20-code-style.md
.claude/rules/40-trading-safety.md
.claude/rules/50-agent-workflow.md
```

For backend changes also read:

```text
.claude/rules/10-architecture.md
.claude/rules/70-server.md
```

For frontend changes also read:

```text
.claude/rules/10-architecture.md
.claude/rules/60-web.md
```

For tests:

```text
.claude/rules/30-testing.md
```

---

## Core Architecture

Maintain this boundary:

```text
market data
    ↓
strategy
    ↓
AI analysis
    ↓
trade proposal
    ↓
risk engine
    ↓
execution engine
    ↓
broker adapter
```

AI produces analysis and proposals.

AI does not control risk limits.

AI does not directly call brokers.

---

## Dependency Rule

Dependencies point toward domain logic.

Backend:

```text
interfaces
     ↓
application
     ↓
domain
     ↑
infrastructure
```

Domain must not depend on infrastructure.

Frontend and backend may share contracts only through:

```text
packages/contracts
```

Never import backend internals from the frontend.

---

## Working Method

Do not immediately edit code after receiving a non-trivial request.

First:

1. inspect relevant files
2. understand existing architecture
3. locate the owning domain
4. identify affected contracts
5. check applicable rules

Then implement the smallest coherent solution.

---

## Scope Control

Do not solve adjacent problems unless necessary.

Avoid:

* unrelated cleanup
* broad rewrites
* speculative abstractions
* replacing working architecture without evidence
* creating generic utility layers prematurely

Prefer incremental changes.

---

## Long Tasks

If a task affects multiple domains or requires several coordinated changes,
create or update:

```text
docs/exec-plans/active/<task>.md
```

Record:

```text
Goal
Current state
Constraints
Plan
Progress
Decisions
Validation
Remaining work
```

Do not rely on conversation memory as the only project state.

The repository is the source of truth.

---

## File Size

Aim for approximately 100 lines per source file when practical.

Split by responsibility, not arbitrary line count.

Good extraction boundaries include:

* UI
* hooks
* use cases
* domain policies
* adapters
* schemas
* mapping
* validation

Do not fragment cohesive logic into meaningless tiny files.

---

## Trading Safety

Paper trading is the default.

Never enable live trading as a side effect of implementation.

Never modify risk limits simply to make a trade pass.

Never allow AI-generated output to override:

* exposure limits
* position limits
* loss limits
* kill switches
* broker mode
* authentication boundaries

All monetary calculations must use explicit units.

---

## Data Integrity

Trading systems are time-sensitive.

Be explicit about:

* timestamps
* timezone
* market session
* candle interval
* price units
* quantity units
* currency
* data source

Never introduce future-data leakage into backtests.

Never silently substitute missing market data.

---

## Verification Loop

After implementation:

1. inspect the diff
2. run relevant tests
3. run type checking
4. run linting
5. validate the changed behavior
6. verify architecture boundaries
7. check for secrets
8. update docs if architecture changed

Do not claim completion when verification failed.

---

## Commands

Use repository scripts when available.

Typical commands:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

If scripts differ, inspect `package.json`.

Do not invent repository commands.

---

## Git

Preserve existing user work.

Never use destructive Git operations unless explicitly requested.

Do not:

```bash
git reset --hard
git clean -fd
git checkout -- .
```

Do not amend user commits unless explicitly requested.

---

## Definition of Done

A change is complete only when:

* behavior matches the request
* ownership is correct
* dependency rules hold
* trading safeguards remain intact
* types are valid
* relevant tests pass
* documentation reflects architecture changes
* the diff contains no unrelated changes

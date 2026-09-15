# AGENTS.md — AI Trader

## Mission

AI Trader is a private AI-assisted automated trading system.

The system must prioritize:

1. capital preservation
2. deterministic risk control
3. auditability
4. reproducibility
5. correctness over speed
6. simple architecture over premature abstraction

AI may propose trades.

AI must never bypass deterministic risk controls or directly execute broker orders.

---

## Repository Map

```text
apps/
  web/        Next.js frontend
  server/     Fastify backend

packages/
  contracts/  shared API/domain contracts
  config/     shared configuration

docs/
  ARCHITECTURE.md
  decisions/
  exec-plans/

.claude/rules/
  00-project.md
  10-architecture.md
  20-code-style.md
  30-testing.md
  40-trading-safety.md
  50-agent-workflow.md
  60-web.md
  70-server.md
```

---

## Source of Truth

Before changing code, read the relevant rules under:

```text
.claude/rules/
```

For architectural changes, also read:

```text
docs/ARCHITECTURE.md
```

For an existing multi-step task, inspect:

```text
docs/exec-plans/active/
```

Do not duplicate detailed rules in this file.

---

## Architecture

The repository is a monorepo.

Application boundaries must remain explicit.

Allowed:

```text
apps/web
   ↓
packages/contracts
   ↑
apps/server
```

Forbidden:

```text
apps/web
   ↓
apps/server/src/*
```

Frontend must never import backend implementation code.

Backend domain logic must never depend on Fastify, PostgreSQL, Drizzle,
OpenAI, broker SDKs, or other infrastructure.

Dependencies must point inward.

---

## Trading Boundary

The execution flow must remain:

```text
Market Data
→ Strategy
→ AI Analysis
→ Trade Proposal
→ Risk Engine
→ Execution Engine
→ Broker Adapter
```

Never allow:

```text
AI → Broker
AI → Order API
Strategy → Broker
UI → Broker
```

The Risk Engine is mandatory.

Risk rules must be deterministic code.

---

## Broker Policy

Default trading mode is always:

```text
paper
```

Live trading must never become enabled implicitly.

Never:

* hard-code broker credentials
* log secrets
* commit `.env`
* bypass the broker adapter
* send real orders from tests
* silently switch paper trading to live trading

See:

```text
.claude/rules/40-trading-safety.md
```

---

## Coding Principles

Prefer:

* small modules
* explicit domain boundaries
* pure functions
* dependency inversion
* composition
* typed contracts
* deterministic behavior

Avoid:

* god files
* god services
* hidden side effects
* deep imports
* circular dependencies
* speculative abstractions
* duplicated business logic

Keep source files around 100 lines when practical.

Do not split cohesive code merely to satisfy a line count.

---

## Change Discipline

Before editing:

1. inspect relevant code
2. identify ownership and layer
3. read applicable rules
4. check existing contracts and patterns
5. make the smallest coherent change

Do not rewrite unrelated code.

Do not perform opportunistic refactors unless required for the task.

---

## Complex Work

For significant work involving multiple domains, migrations, infrastructure,
or more than a few coordinated steps, create:

```text
docs/exec-plans/active/<task-name>.md
```

Keep it updated with:

* goal
* constraints
* affected areas
* decisions
* progress
* validation
* remaining work

Move it to:

```text
docs/exec-plans/completed/
```

when finished.

---

## Validation

After changes, run the most relevant available checks.

Expected repository-level commands:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Do not invent commands that do not exist.

If a command or test cannot be run, state why.

A task is not complete merely because the code compiles.

Validate behavior relevant to the change.

---

## Git Safety

Never run destructive Git commands unless explicitly requested.

Do not use:

```bash
git reset --hard
git clean -fd
git checkout -- .
```

Do not discard unrelated user changes.

Never amend or rewrite user commits without explicit instruction.

---

## Documentation

Architecture-changing decisions must be reflected in:

```text
docs/ARCHITECTURE.md
```

Important irreversible or non-obvious decisions should receive a record under:

```text
docs/decisions/
```

Documentation must describe current behavior, not intended fiction.

---

## Final Check

Before finishing, verify:

* architecture boundaries remain valid
* no deep imports were introduced
* trading safety constraints remain intact
* tests/checks relevant to the change were run
* no secrets were added
* documentation was updated when architecture changed
* unrelated files were not modified

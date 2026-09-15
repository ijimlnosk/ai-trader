Project Principles

AI Trader is a private automated trading system.

Optimize for:

correctness
capital protection
reproducibility
observability
maintainability
simplicity

Do not optimize prematurely for scale.

This is initially a single-user system.

Do not introduce multi-tenant architecture unless explicitly required.

Source of Truth

The repository is the source of truth.

Do not depend on conversational memory for:

architecture
API contracts
business rules
risk policies
implementation state

Persist important information in repository documentation.

Package Manager

Use:

pnpm

Do not introduce npm, Yarn, or Bun lockfiles.

Shared Contracts

Shared frontend/backend types belong in:

packages/contracts

Only genuinely shared contracts belong there.

Do not move implementation-specific types into shared packages.

Environment

Secrets belong in environment variables.

Commit:

.env.example

Never commit:

.env
.env.local
credentials
broker secrets
API secrets
tokens
account numbers
Harness Principle

Agents need a map, not an encyclopedia.

Root instruction files remain short.

Detailed knowledge belongs in structured repository documents.

Before Coding

For non-trivial work:

inspect repository state
locate relevant ownership
read applicable rules
inspect related tests
inspect existing patterns
determine the smallest valid change

Do not assume architecture from filenames alone.

Search First

Before creating new:

component
hook
service
utility
schema
type
adapter
repository

search for an existing equivalent.

Avoid duplicate abstractions.

Small Changes

Prefer the smallest coherent patch.

Do not rewrite entire modules when a focused change is sufficient.

Complex Tasks

Create:

docs/exec-plans/active/<task>.md

when work:

spans several domains
involves a migration
changes architecture
requires coordinated frontend/backend work
has multiple implementation phases
is likely to exceed one agent session
Execution Plan Template

Use:

# Goal

# Constraints

# Current State

# Plan

- [ ] Step 1
- [ ] Step 2

# Decisions

# Progress

# Validation

# Remaining Work

Update the plan while working.

Do not mark work complete before validation.

Decision Records

Create a decision record when a decision is:

architectural
difficult to reverse
non-obvious
likely to be questioned later

Store under:

docs/decisions/
Context Recovery

When resuming work:

read AGENTS.md or CLAUDE.md
inspect active execution plans
inspect git status
inspect relevant code
continue from repository state

Do not rely solely on prior chat context.

Verification

Before finishing:

diff
typecheck
tests
lint
build when relevant

Then inspect for:

architecture violations
secrets
unsafe trading behavior
unrelated changes
Failure Handling

If verification fails:

diagnose it
fix it if caused by the change
do not hide it
distinguish pre-existing failures from introduced failures
No Fake Completion

Never claim:

implemented
working
tested
fixed

unless corresponding work or validation actually occurred.
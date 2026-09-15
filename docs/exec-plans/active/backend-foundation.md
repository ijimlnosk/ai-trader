# Goal
Executable paper-only Fastify/PostgreSQL foundation.
# Constraints
Preserve existing instructions and DB volumes. No orders, AI, KIS or production migrations.
# Current State
Implementation and available local validation complete. Actual DB/image verification remains open.
# Plan
- [x] Workspace and strict tooling
- [x] Environment, safety policy, health and broker boundary
- [x] Schema, generated migration and Docker configuration
- [x] Tests, production package build and documentation
- [ ] Verify real PostgreSQL 17 connection and apply migration in a disposable database
- [ ] Verify Docker Compose configuration and image build where Docker is installed
# Decisions
Node 24 LTS production runtime; local checks used Node 26.7.0. TypeScript 5.9 is compatible with
current typescript-eslint; pnpm 10.17.1 is pinned for reproducible workspace deployment.
Public package exports; exact decimal strings and explicit currencies in PostgreSQL.
Live broker configuration fails closed. Existing DB volume must be explicitly selected externally.
See docs/decisions/0001-foundation-boundaries.md.
# Progress
Read all requested repository rules; no existing implementation to reuse. Added all requested
foundation components and generated the first four-table migration without connecting to a DB.
No pre-existing user file was changed. No operational DB, volume, or Git state was mutated.
# Validation
- pnpm install and frozen-lockfile install: passed using temporary pnpm installation.
- pnpm typecheck, pnpm lint, pnpm build: passed.
- pnpm test: 22 tests passed across two files.
- pnpm --filter server db:generate: passed; generated SQL reviewed.
- pnpm --filter server deploy --prod: passed in a temporary directory.
- Production artifacts include compiled server/migrator, SQL metadata and contracts dist.
- Production top-level node_modules excludes TypeScript, Vitest, ESLint and Drizzle Kit.
- Production startup rejects missing DATABASE_URL, unsupported live mode, and unavailable DB;
  exit status 1 and no test password disclosure verified.
- Health 200/503 and paper mode validated with injected DB ports (not a real PostgreSQL connection).
- Relative import graph checked: 13 server source files, no circular dependencies.
- git diff --check and .env/.env.local ignore checks passed.
- Docker CLI and PostgreSQL executables are not installed; no operational credentials provided.
# Remaining Work
Operator must complete the two environment-dependent checks above using README instructions.
Keep this plan active until real PostgreSQL and Docker verification are recorded. Do not interpret
production packaging success as Docker image or real database success.

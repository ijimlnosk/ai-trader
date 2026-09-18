# Goal
Deterministic daily strategy, explicit-universe screening and reproducible offline backtests using existing risk and ledger logic.
# Constraints
Paper only. No AI, scheduler, real orders, new dependencies or database migration. Exact decimal money; indicator arithmetic may use numbers. No future data in strategy inputs.
# Current State
Quotes have receipt timestamps only; no historical candle port or sizing implementation exists. Existing order service reserves UUID keys durably and rechecks account, risk and quotes. Ledger projects moving-average basis.
# Plan
- [x] Validated daily candle dataset, indicators, screener and strategy
- [x] Proposal/risk evaluation and opt-in existing paper execution integration
- [x] Isolated next-open backtest and file/sample CLI
- [x] Behavior tests, documentation and repository gates
# Decisions
Daily KRX regular-session data, UTC timestamps and explicit expected session dates. Missing bars fail closed; no interpolation. Dataset must declare raw unadjusted prices; corporate actions unsupported.
EMA seeds with SMA; RSI/ATR use Wilder smoothing (14), EMA20/60 warm-up requires 61 bars for a cross. Volume ratio excludes the current bar.
BUY only on bullish EMA20/60 crossover, close above EMA20, RSI 50–70 inclusive, volume ratio >=1.2; SELL held shares when EMA20 <= EMA60 or close < EMA60. SELL bypasses liquidity filters, but requires valid data. No pyramiding/shorting.
ATR sizes BUY at 1% equity divided by 2 ATR, capped at 9% equity and cash; these are explicit strategy settings, not risk-policy changes or claims of profitability. Confidence 1 denotes deterministic rule satisfaction, not predictive probability.
Backtest assesses risk again at the slipped next-session open using only open marks; costs are exact basis-point arithmetic rounded up to 1e-8 KRW. Net BUY costs and net SELL proceeds feed a separate instance of the existing ledger projection. Every evaluated decision and input is reportable. Explicit universe order is normalized lexically for allocation ties.
# Progress
Read applicable rules, architecture, active plans, risk/execution/ledger ownership and existing contracts. Initial worktree clean.
Implemented domain strategy/indicators/screening, strict data adapter, protected explicit paper evaluation,
isolated net-cost backtest, CLI and shared data/provenance contracts. Existing risk limits unchanged.
Selected-symbol candles and sizing account persist alongside strategy metadata in existing request JSONB;
proposal reason distinguishes strategy origin. Documented timing, thresholds, replay and limitations.
Used an already cached pnpm 10.17.1 executable via a temporary PATH shim; no installation/dependency change.
# Validation
2026-09-18: pnpm lint, pnpm typecheck and pnpm build passed.
Default pnpm test: 404 passed, 10 PostgreSQL tests intentionally skipped without a DB URL.
All 10 database tests then passed against a fresh isolated PostgreSQL 17.6 cluster, including
strategy JSONB provenance, repository recreation/replay, changed-payload conflicts, legacy data,
account serialization and transaction rollback. Cluster stopped after verification. No broker orders.
41 new strategy/data/backtest/HTTP tests plus one new DB provenance test; 414 total checks passed
across the default and dedicated database runs.
CLI --sample, --file with nonzero costs, and --evaluate completed with valid JSON. Source and
compiled sample reports matched exactly. Sample covers entries, exits and final open holdings.
Future-data mutation preserves earlier signal/risk results and next-open execution audits.
Reconstructed a persisted strategy signal from its candles and sizing account.
git diff --check passed. No dependencies, lockfile, environment, migration or operational DB changed.
# Remaining Work
None for the implemented v1 acceptance conditions. Historical KIS ingestion, authoritative calendars,
corporate actions and live paper-account order confirmation remain outside this increment and are
explicitly documented in docs/STRATEGY.md. No automatic execution has been enabled.

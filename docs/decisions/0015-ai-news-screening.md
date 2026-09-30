# 0015 — AI news screening of momentum candidates (record-only)

Date: 2026-09-30. Status: accepted, record-only. Enforcement (vetoing BUYs) needs a separate decision
after reviewing recorded verdicts against subsequent price moves.

- Each reviewed session, after the momentum plan, `createNewsScreener` sends the last seven days of
  archived headlines (≤ 20) for each BUY candidate (plan order) and each holding to Claude
  (`claude-opus-5-5`, effort `low`, structured output validated with zod). Output: verdict
  `clear|caution|veto`, categories, confidence, Korean summary, evidence indexes. One record per
  session and symbol in `news_assessments` (migration 0010); restarts do not repeat calls; symbols
  without news are recorded without a call.
- Refusal, truncation, schema violation or provider errors are `unavailable`; when enforcement is
  enabled that will mean "do not buy". Refusal fallbacks to another model are intentionally not used.
- Budget (owner limit about KRW 10,000/month): `AI_DAILY_BUDGET_USD` default 0.50 (max 1),
  `AI_MONTHLY_BUDGET_USD` default 6.50 (max 7). Each call reserves a worst case (2 × input characters
  as tokens + 2,048 output tokens) in `external_api_usage` (provider `anthropic-news-screen`, micro-USD)
  and refunds the difference after the actual usage is known. Exhaustion stops calls for the period.
- Measured 2026-09-30 on five real symbols: input ≈ 4,300–4,700 tokens, output ≈ 150–220 tokens;
  Opus 5.5 ≈ $0.022, Sonnet 5.5 ≈ $0.011, Haiku 4.5 ≈ $0.005 per call. Sonnet and Opus agreed on all
  five; Haiku missed one dilution concern. Expected spend ≈ $3–5/month at ~150 calls.
- The AI cannot place orders, change risk limits or sell; it only records an opinion.

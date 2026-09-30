import { createHash } from 'node:crypto';
import { seoulOrderDate } from '../../domain/orders.ts';
import type { MomentumEvaluation } from '../../domain/strategy/momentum.ts';
import { planSession } from '../../domain/strategy/plan.ts';
import { universeName } from '../../domain/market/universe.ts';
import type { ApiQuota, NewsRepository, QuotaCaps } from '../news/ports.ts';
import type { StrategyRunRecord } from '../scheduler/index.ts';
import { MOMENTUM_PLAN_PREFIX } from '../strategy/momentumPlan.ts';
import type { NewsAssessment, NewsAssessor } from './ports.ts';

export const AI_COST_PROVIDER = 'anthropic-news-screen';

export interface AssessmentRecord {
  sessionDate: string; symbol: string; model: string;
  status: 'assessed' | 'unavailable' | 'no_news' | 'budget_exhausted';
  verdict: NewsAssessment['verdict'] | null; assessment: NewsAssessment | null; reason: string | null;
  articleCount: number; inputSha256: string; inputTokens: number | null; outputTokens: number | null; costMicroUsd: number | null;
}
export interface AssessmentRepository {
  find(sessionDate: string, symbol: string): Promise<AssessmentRecord | null>;
  save(record: AssessmentRecord): Promise<void>;
  listForSession(sessionDate: string): Promise<AssessmentRecord[]>;
}
export interface ScreenResult { targets: number; assessed: number; unavailable: number; noNews: number; skipped: number;
  budgetExhausted: boolean; costMicroUsd: number }

/**
 * Screens today's momentum BUY candidates (plan order) and current holdings with the AI assessor.
 * One record per session and symbol makes restarts free. Every call reserves its worst-case cost
 * first and refunds the difference, so the micro-USD caps cannot be exceeded.
 */
export function createNewsScreener(deps: { assessor: NewsAssessor; news: NewsRepository; quota: ApiQuota; caps: QuotaCaps;
  repository: AssessmentRepository; plans: { latestPlanRun(prefix: string): Promise<StrategyRunRecord | null> }; now?: () => Date }) {
  const now = deps.now ?? (() => new Date());
  return async (): Promise<ScreenResult | null> => {
    const sessionDate = seoulOrderDate(now().toISOString());
    const run = await deps.plans.latestPlanRun(MOMENTUM_PLAN_PREFIX);
    if (!run || run.sessionDate !== sessionDate || run.result.evaluations.length === 0) return null;
    const signals = run.result.evaluations.map((evaluation) => evaluation.signal as unknown as MomentumEvaluation);
    const plan = planSession(signals, run.result.evaluations[0]!.context);
    const buys = plan.items.filter((item) => item.side === 'BUY').map((item) => item.symbol);
    const held = signals.filter((signal) => signal.heldQuantity !== '0').map((signal) => signal.symbol);
    const targets = [...new Set([...buys, ...held])];
    const result: ScreenResult = { targets: targets.length, assessed: 0, unavailable: 0, noNews: 0, skipped: 0, budgetExhausted: false, costMicroUsd: 0 };
    const since = new Date(now().getTime() - 7 * 86400000).toISOString();
    const month = sessionDate.slice(0, 6);
    for (const symbol of targets) {
      if (await deps.repository.find(sessionDate, symbol)) { result.skipped += 1; continue; }
      const articles = (await deps.news.recentForSymbol(symbol, since, 20)).map(({ title, description, publishedAt }) => ({ title, description, publishedAt }));
      const input = { symbol, name: universeName(symbol) ?? symbol, asOf: now().toISOString(), articles };
      const base = { sessionDate, symbol, model: deps.assessor.model, articleCount: articles.length,
        inputSha256: createHash('sha256').update(JSON.stringify(articles)).digest('hex'), inputTokens: null, outputTokens: null, costMicroUsd: null };
      if (articles.length === 0) {
        await deps.repository.save({ ...base, status: 'no_news', verdict: null, assessment: null, reason: null });
        result.noNews += 1; continue;
      }
      const reserve = deps.assessor.worstCaseMicroUsd(input);
      if (!await deps.quota.consume(AI_COST_PROVIDER, sessionDate, month, deps.caps, reserve)) {
        await deps.repository.save({ ...base, status: 'budget_exhausted', verdict: null, assessment: null, reason: null });
        result.budgetExhausted = true; break;
      }
      const assessment = await deps.assessor.assess(input);
      const spent = Math.min(reserve, assessment.usage?.costMicroUsd ?? 0);
      if (reserve > spent) await deps.quota.refund(AI_COST_PROVIDER, sessionDate, month, reserve - spent);
      result.costMicroUsd += spent;
      const usage = { inputTokens: assessment.usage?.inputTokens ?? null, outputTokens: assessment.usage?.outputTokens ?? null, costMicroUsd: spent };
      if (assessment.status === 'assessed') {
        await deps.repository.save({ ...base, ...usage, status: 'assessed', verdict: assessment.assessment.verdict, assessment: assessment.assessment, reason: null });
        result.assessed += 1;
      } else {
        await deps.repository.save({ ...base, ...usage, status: 'unavailable', verdict: null, assessment: null, reason: assessment.reason });
        result.unavailable += 1;
      }
    }
    return result;
  };
}
export type NewsScreener = ReturnType<typeof createNewsScreener>;

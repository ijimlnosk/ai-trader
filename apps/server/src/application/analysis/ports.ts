import { z } from 'zod';

export const NEWS_CATEGORIES = ['litigation', 'earnings', 'dilution', 'regulation', 'governance', 'accident',
  'suspension_or_delisting', 'macro', 'other'] as const;

/** Model output contract. Validated again after the provider's own schema enforcement. */
export const newsAssessmentSchema = z.object({
  verdict: z.enum(['clear', 'caution', 'veto']),
  categories: z.array(z.enum(NEWS_CATEGORIES)).max(5),
  confidence: z.number().min(0).max(1),
  summary: z.string().min(1).max(400),
  evidence: z.array(z.number().int().min(0).max(49)).max(10),
});
export type NewsAssessment = z.infer<typeof newsAssessmentSchema>;

export interface AssessmentInput {
  symbol: string; name: string; asOf: string;
  articles: readonly { title: string; description: string; publishedAt: string }[];
}
export interface AssessmentUsage { model: string; inputTokens: number; outputTokens: number; costMicroUsd: number }
export type AssessmentResult =
  | { status: 'assessed'; assessment: NewsAssessment; usage: AssessmentUsage }
  /** Refusal, malformed output, truncation or provider error: callers must treat as "do not buy". */
  | { status: 'unavailable'; reason: string; usage: AssessmentUsage | null };

export interface NewsAssessor {
  readonly model: string;
  /** Upper bound on one call's cost, for pre-call budget reservation. */
  worstCaseMicroUsd(input: AssessmentInput): number;
  assess(input: AssessmentInput): Promise<AssessmentResult>;
}

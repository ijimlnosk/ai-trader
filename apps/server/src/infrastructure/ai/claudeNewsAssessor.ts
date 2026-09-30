import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { newsAssessmentSchema, type AssessmentInput, type NewsAssessor } from '../../application/analysis/ports.ts';
import { costMicroUsd, MODEL_PRICING } from './pricing.ts';

const MAX_OUTPUT_TOKENS = 2048;

const SYSTEM = `You screen recent Korean news headlines about one listed company for a paper-trading system.
Only the provided articles are evidence; do not use outside knowledge and do not predict prices.
verdict:
- "veto": a severe company-specific negative event reported in these articles that makes a new purchase
  imprudent now (e.g. embezzlement or fraud, trading suspension or delisting risk, audit opinion refusal,
  large dilutive rights offering, major lawsuit loss, serious recall or accident, regulatory sanction).
- "caution": notable but uncertain or moderate negative news.
- "clear": nothing material, routine coverage, market-wide news, or positive news.
Generic market commentary, price-move reports and other companies' news are not company-specific events.
Return categories that apply, confidence 0-1, a summary in Korean of at most two sentences, and the
indexes of the articles that support the verdict.`;

/** Claude news screener. Any refusal, truncation or invalid output is "unavailable" (no purchase). */
export function createClaudeNewsAssessor(config: { apiKey: string; model: string; effort?: 'low' | 'medium' | 'high' },
  client: Pick<Anthropic, 'messages'> = new Anthropic({ apiKey: config.apiKey, maxRetries: 1, timeout: 60000 })): NewsAssessor {
  if (!MODEL_PRICING[config.model]) throw new Error(`Unsupported model ${config.model}`);
  const supportsEffort = config.model !== 'claude-haiku-4-5';
  const render = (input: AssessmentInput) => [`Company: ${input.name} (${input.symbol}). As of: ${input.asOf}.`, 'Articles (newest first):',
    ...input.articles.map((a, i) => `[${i}] ${a.publishedAt} | ${a.title} | ${a.description}`)].join('\n');
  return {
    model: config.model,
    // Measured ~1 token per character for Korean headlines; reserve twice that plus framing, and the full output cap.
    worstCaseMicroUsd: (input) => costMicroUsd(config.model, 2 * (SYSTEM.length + render(input).length) + 500, MAX_OUTPUT_TOKENS),
    async assess(input) {
      try {
        const response = await client.messages.parse({
          model: config.model, max_tokens: MAX_OUTPUT_TOKENS, system: SYSTEM,
          messages: [{ role: 'user', content: render(input) }],
          output_config: { format: zodOutputFormat(newsAssessmentSchema), ...(supportsEffort ? { effort: config.effort ?? 'low' } : {}) },
        });
        const usage = { model: config.model, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens,
          costMicroUsd: costMicroUsd(config.model, response.usage.input_tokens, response.usage.output_tokens) };
        if (response.stop_reason !== 'end_turn') return { status: 'unavailable', reason: `stop_${response.stop_reason}`, usage };
        const parsed = newsAssessmentSchema.safeParse(response.parsed_output);
        if (!parsed.success || parsed.data.evidence.some((index) => index >= input.articles.length)) {
          return { status: 'unavailable', reason: 'invalid_output', usage };
        }
        return { status: 'assessed', assessment: parsed.data, usage };
      } catch (error) {
        return { status: 'unavailable', reason: error instanceof Anthropic.APIError ? `api_${error.status ?? 'error'}` : 'provider_error', usage: null };
      }
    },
  };
}

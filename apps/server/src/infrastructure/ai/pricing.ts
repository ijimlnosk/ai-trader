/**
 * USD per million tokens, Anthropic first-party rates (claude-api skill table cached 2026-09-25).
 * Used for budget enforcement; update when prices change.
 */
export const MODEL_PRICING: Readonly<Record<string, { input: number; output: number }>> = Object.freeze({
  'claude-opus-5-5': { input: 4, output: 20 },
  'claude-sonnet-5-5': { input: 2, output: 10 },
  'claude-haiku-4-5': { input: 1, output: 5 },
});

/** Cost in micro-dollars (1e-6 USD), rounded up so budgets err on the safe side. */
export function costMicroUsd(model: string, inputTokens: number, outputTokens: number): number {
  const price = MODEL_PRICING[model];
  if (!price) throw new Error(`No pricing for model ${model}`);
  return Math.ceil(inputTokens * price.input + outputTokens * price.output);
}

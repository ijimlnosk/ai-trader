import { readFileSync } from 'node:fs';
import { createClaudeNewsAssessor } from '../infrastructure/ai/claudeNewsAssessor.ts';
import { universeName } from '../domain/market/universe.ts';

/** One-off cost/quality measurement over an exported news sample. Prints no credentials. */
const [samplePath, ...models] = process.argv.slice(2);
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!samplePath || !apiKey || models.length === 0) throw new Error('Usage: measureNewsAssessor SAMPLE.json MODEL...');
const sample = JSON.parse(readFileSync(samplePath, 'utf8')) as { symbol: string; articles: { title: string; description: string; publishedAt: string }[] }[];
for (const model of models) {
  const assessor = createClaudeNewsAssessor({ apiKey, model, effort: 'low' });
  let total = 0;
  for (const { symbol, articles } of sample) {
    const started = Date.now();
    const input = { symbol, name: universeName(symbol) ?? symbol, asOf: '2026-09-30', articles };
    const result = await assessor.assess(input);
    total += result.usage?.costMicroUsd ?? 0;
    console.log(JSON.stringify({ model, symbol, ms: Date.now() - started, worstCase: assessor.worstCaseMicroUsd(input), status: result.status,
      usage: result.usage, ...(result.status === 'assessed' ? { verdict: result.assessment.verdict, categories: result.assessment.categories,
        confidence: result.assessment.confidence, summary: result.assessment.summary, evidence: result.assessment.evidence } : { reason: result.reason }) }));
  }
  console.log(JSON.stringify({ model, totalMicroUsd: total }));
}

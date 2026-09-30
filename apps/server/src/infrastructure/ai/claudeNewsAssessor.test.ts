import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';
import { createClaudeNewsAssessor } from './claudeNewsAssessor.ts';
import { costMicroUsd } from './pricing.ts';

const input = { symbol: '000660', name: 'SK하이닉스', asOf: '2026-10-07T00:00:00Z',
  articles: [{ title: '제목', description: '요약', publishedAt: '2026-10-06T00:00:00Z' }] };
const valid = { verdict: 'caution', categories: ['dilution'], confidence: 0.6, summary: '희석 우려', evidence: [0] };
type ParseRequest = { model: string; output_config: { effort?: string } };
const reply = (patch: object) => ({ stop_reason: 'end_turn', usage: { input_tokens: 4600, output_tokens: 170 }, parsed_output: valid, ...patch });
const assessor = (parse: ReturnType<typeof vi.fn>, model = 'claude-opus-5-5') =>
  createClaudeNewsAssessor({ apiKey: 'test', model }, { messages: { parse } } as unknown as Anthropic);

describe('Claude news assessor', () => {
  it('returns the validated assessment with exact cost and uses low effort on Opus', async () => {
    const parse = vi.fn<(request: ParseRequest) => Promise<ReturnType<typeof reply>>>(async () => reply({}));
    const result = await assessor(parse).assess(input);
    expect(result).toEqual({ status: 'assessed', assessment: valid, usage: { model: 'claude-opus-5-5', inputTokens: 4600, outputTokens: 170, costMicroUsd: 21800 } });
    expect(parse.mock.calls[0]![0]).toMatchObject({ model: 'claude-opus-5-5', output_config: { effort: 'low' } });
  });

  it('omits effort for Haiku', async () => {
    const parse = vi.fn<(request: ParseRequest) => Promise<ReturnType<typeof reply>>>(async () => reply({}));
    await assessor(parse, 'claude-haiku-4-5').assess(input);
    expect(parse.mock.calls[0]![0].output_config.effort).toBeUndefined();
  });

  it.each([
    ['refusal', reply({ stop_reason: 'refusal' }), 'stop_refusal'],
    ['truncation', reply({ stop_reason: 'max_tokens' }), 'stop_max_tokens'],
    ['schema violation', reply({ parsed_output: { ...valid, verdict: 'buy' } }), 'invalid_output'],
    ['evidence out of range', reply({ parsed_output: { ...valid, evidence: [5] } }), 'invalid_output'],
  ])('treats %s as unavailable but still reports its usage', async (_name, response, reason) => {
    const result = await assessor(vi.fn(async () => response)).assess(input);
    expect(result).toMatchObject({ status: 'unavailable', reason, usage: { costMicroUsd: 21800 } });
  });

  it('treats provider errors as unavailable without usage', async () => {
    const result = await assessor(vi.fn(async () => { throw new Error('network'); })).assess(input);
    expect(result).toEqual({ status: 'unavailable', reason: 'provider_error', usage: null });
  });

  it('reserves more than a realistic call costs', () => {
    expect(assessor(vi.fn()).worstCaseMicroUsd(input)).toBeGreaterThan(costMicroUsd('claude-opus-5-5', 4600, 170));
  });
});

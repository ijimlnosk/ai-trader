import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createKisClient, KIS_PAPER_URL, type KisFetch } from './kisClient.ts';

const config = { baseUrl: KIS_PAPER_URL, appKey: 'fixture-key', appSecret: 'fixture-secret' };
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it('spaces concurrent token/read/order transport starts and never bursts after a delayed response', async () => {
  const starts: number[] = [];
  const fetcher = vi.fn<KisFetch>().mockImplementation(async () => {
    starts.push(performance.now());
    if (starts.length === 1) await new Promise((resolve) => setTimeout(resolve, 4000));
    return new Response('{}');
  });
  const client = createKisClient(config, fetcher, 1500);
  const results = Promise.all([
    client.request('/oauth2/tokenP', { method: 'POST' }),
    client.request('/read-a', { method: 'GET' }),
    client.request('/read-b', { method: 'GET' }),
  ]);
  await vi.advanceTimersByTimeAsync(4000);
  expect(starts).toEqual([0, 4000]);
  await vi.advanceTimersByTimeAsync(1499);
  expect(starts).toHaveLength(2);
  await vi.advanceTimersByTimeAsync(1);
  await results;
  expect(starts).toEqual([0, 4000, 5500]);
});

it('a failed transport is not retried and does not poison subsequent queued work', async () => {
  const fetcher = vi.fn<KisFetch>().mockRejectedValueOnce(new Error('private-secret'))
    .mockResolvedValue(new Response('{}'));
  const client = createKisClient(config, fetcher, 1500);
  const failed = expect(client.request('/first', { method: 'POST' })).rejects.toMatchObject({ code: 'provider_unavailable' });
  const next = client.request('/next', { method: 'GET' });
  await vi.advanceTimersByTimeAsync(1499);
  expect(fetcher).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  await Promise.all([failed, next]);
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it('bounds outstanding work and rejects excess before transport', async () => {
  const fetcher = vi.fn<KisFetch>().mockImplementation(async () => new Response('{}'));
  const client = createKisClient(config, fetcher, 1500);
  const requests = Array.from({ length: 9 }, () => client.request('/read', { method: 'GET' }));
  const results = Promise.allSettled(requests);
  await vi.runAllTimersAsync();
  const settled = await results;
  expect(settled.filter((r) => r.status === 'fulfilled')).toHaveLength(8);
  expect(fetcher).toHaveBeenCalledTimes(8);
});

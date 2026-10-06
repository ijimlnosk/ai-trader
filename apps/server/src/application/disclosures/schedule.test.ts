import { describe, expect, it, vi } from 'vitest';
import { createDisclosureSchedule } from './schedule.ts';

const result = { from: '20260929', through: '20261006', calls: 8, scanned: 772, saved: 3, budgetExhausted: false };

describe('disclosure schedule', () => {
  it('collects once per session morning inside 08:15–08:55 KST', async () => {
    let now = new Date('2026-10-05T23:14:00.000Z');
    const collect = vi.fn(async () => result); const report = vi.fn();
    const step = createDisclosureSchedule({ collect, report, now: () => now });
    await step();
    now = new Date('2026-10-05T23:15:00.000Z'); await step(); await step();
    expect(collect).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith('disclosures_collected', expect.objectContaining({ saved: '3', calls: '8' }));
  });

  it('skips closures and retries failures 10 minutes apart, at most three times', async () => {
    let now = new Date('2026-10-08T23:20:00.000Z');
    const collect = vi.fn(async () => { throw new Error('dart_http_500'); }); const report = vi.fn();
    const step = createDisclosureSchedule({ collect, report, now: () => now });
    await step();
    expect(collect).not.toHaveBeenCalled();
    for (const minute of [15, 16, 25, 35, 45]) { now = new Date(`2026-10-05T23:${minute}:00.000Z`); await step(); }
    expect(collect).toHaveBeenCalledTimes(3);
    expect(report).toHaveBeenLastCalledWith('disclosures_failed', { attempt: '3', reason: 'dart_http_500' });
  });
});

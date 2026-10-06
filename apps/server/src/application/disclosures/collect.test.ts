import { describe, expect, it, vi } from 'vitest';
import type { ApiQuota } from '../news/ports.ts';
import { createDisclosureCollector } from './collect.ts';
import type { Disclosure, DisclosurePage } from './ports.ts';

const filing = (receiptNo: string, stockCode: string): Disclosure => ({ receiptNo, corpCode: '00126380', corpName: 'c', stockCode, corpClass: 'Y',
  reportName: 'r', filerName: 'f', receiptDate: '20261002', remarks: '' });
const quota = (allowed: number): ApiQuota => {
  let used = 0;
  return { consume: async () => (used += 1) <= allowed, refund: async () => {}, usage: async () => ({ daily: used, monthly: used }) };
};

function setup(pages: DisclosurePage[], allowed = 100) {
  const listPage = vi.fn(async (_from: string, _through: string, page: number) => pages[page - 1]!);
  const save = vi.fn(async (items: readonly unknown[]) => items.length);
  const collect = createDisclosureCollector({ source: { provider: 'opendart', listPage }, quota: quota(allowed), caps: { daily: 500, monthly: 10000 },
    repository: { save }, symbols: ['005930', '066570'], now: () => new Date('2026-10-05T23:20:00.000Z') });
  return { collect, listPage, save };
}

describe('disclosure collector', () => {
  it('pages the last seven Seoul days and keeps only universe filings', async () => {
    const { collect, listPage, save } = setup([{ totalPages: 2, items: [filing('1', '005930'), filing('2', '')] },
      { totalPages: 2, items: [filing('3', '066570'), filing('4', '999999')] }]);
    expect(await collect()).toEqual({ from: '20260929', through: '20261006', calls: 2, scanned: 4, saved: 2, budgetExhausted: false });
    expect(listPage.mock.calls.map((call) => call.slice(0, 3))).toEqual([['20260929', '20261006', 1], ['20260929', '20261006', 2]]);
    expect(save.mock.calls.flatMap(([items]) => items.map((item) => (item as { receiptNo: string; provider: string }).provider + ':' + (item as { receiptNo: string }).receiptNo)))
      .toEqual(['opendart:1', 'opendart:3']);
  });

  it('stops before a call the budget refuses', async () => {
    const { collect, listPage } = setup([{ totalPages: 3, items: [] }, { totalPages: 3, items: [] }, { totalPages: 3, items: [] }], 2);
    expect(await collect()).toMatchObject({ calls: 2, budgetExhausted: true });
    expect(listPage).toHaveBeenCalledTimes(2);
  });

  it('handles a range with no filings in one call', async () => {
    const { collect, save } = setup([{ totalPages: 0, items: [] }]);
    expect(await collect()).toMatchObject({ calls: 1, scanned: 0, saved: 0 });
    expect(save).not.toHaveBeenCalled();
  });
});

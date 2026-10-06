import { seoulOrderDate } from '../../domain/orders.ts';
import type { ApiQuota, QuotaCaps } from '../news/ports.ts';
import type { DisclosureRepository, DisclosureSource } from './ports.ts';

/** Seven calendar days cover the longest KRX closure run, so a missed morning is caught up next time. */
const LOOKBACK_DAYS = 7;

export interface DisclosureCollectionResult { from: string; through: string; calls: number; scanned: number; saved: number; budgetExhausted: boolean }

function daysBefore(date: string, days: number): string {
  const value = new Date(Date.UTC(+date.slice(0, 4), +date.slice(4, 6) - 1, +date.slice(6) - days));
  return value.toISOString().slice(0, 10).replaceAll('-', '');
}

/**
 * Pages through every filing of the last seven Seoul days and keeps those of the given symbols.
 * Each page reserves one call of the persisted budget first; a refusal stops the run. Rows are
 * insert-only by receipt number, so repeated runs only add what is new. Data only: nothing trades.
 */
export function createDisclosureCollector(deps: { source: DisclosureSource; quota: ApiQuota; caps: QuotaCaps;
  repository: DisclosureRepository; symbols: readonly string[]; now?: () => Date }) {
  const now = deps.now ?? (() => new Date());
  const wanted = new Set(deps.symbols);
  return async (): Promise<DisclosureCollectionResult> => {
    const through = seoulOrderDate(now().toISOString());
    const result: DisclosureCollectionResult = { from: daysBefore(through, LOOKBACK_DAYS), through, calls: 0, scanned: 0, saved: 0, budgetExhausted: false };
    for (let page = 1, totalPages = 1; page <= totalPages; page += 1) {
      if (!await deps.quota.consume(deps.source.provider, through, through.slice(0, 6), deps.caps)) { result.budgetExhausted = true; break; }
      result.calls += 1;
      const listed = await deps.source.listPage(result.from, through, page);
      totalPages = listed.totalPages;
      result.scanned += listed.items.length;
      const collectedAt = now().toISOString();
      const kept = listed.items.filter((item) => wanted.has(item.stockCode)).map((item) => ({ ...item, provider: deps.source.provider, collectedAt }));
      if (kept.length > 0) result.saved += await deps.repository.save(kept);
    }
    return result;
  };
}
export type DisclosureCollector = ReturnType<typeof createDisclosureCollector>;

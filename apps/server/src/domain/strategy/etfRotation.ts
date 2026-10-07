/**
 * Virtual ETF rotation `etf-v1` (docs/ETF_MOMENTUM_RESEARCH_2026-10-07.md): once a week, hold the 3 ETFs with the best
 * 20-session return among those above their 120-day average; keep holdings while they stay in the top 6.
 */
export const ETF_V1 = Object.freeze({ id: 'etf-v1', capitalKrw: 500_000n, positions: 3, keepRanks: 6, lookback: 20, trendMa: 120 });
export type EtfConfig = typeof ETF_V1;

const mean = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

/** Ranking only (numbers are not used for money): symbols with a positive return above their trend, best first. */
export function rankEtfs(series: readonly { symbol: string; closes: readonly number[] }[], config: EtfConfig = ETF_V1): string[] {
  return series.flatMap(({ symbol, closes }) => {
    if (closes.length < Math.max(config.lookback, config.trendMa) + 1) return [];
    const last = closes.at(-1)!; const score = last / closes.at(-1 - config.lookback)! - 1;
    return score > 0 && last > mean(closes.slice(-config.trendMa)) ? [{ symbol, score }] : [];
  }).sort((a, b) => b.score - a.score || a.symbol.localeCompare(b.symbol)).map((row) => row.symbol);
}

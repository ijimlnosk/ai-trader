// Research-only (not production): raw KIS daily bars for a symbol list, aligned to the most common session list.
// Runs inside the server container (paper runtime, `/app/dist`); the runner prepends
// `const SYMBOLS = [[code, name], ...];`. Symbols whose sessions differ (late listing, halts) are excluded and
// reported, never padded. Completed bars only: set THROUGH to the last completed session.
/* global SYMBOLS */
import { createKisSession } from '/app/dist/infrastructure/broker/kis/kisSession.js';

const env = process.env;
if (env.BROKER_MODE !== 'paper' || env.LIVE_TRADING_ENABLED !== 'false') throw new Error('unsafe runtime');
const session = createKisSession({ baseUrl: env.KIS_BASE_URL, appKey: env.KIS_APP_KEY, appSecret: env.KIS_APP_SECRET }, undefined, Date.now, undefined, 1500);
const through = env.THROUGH ?? '20261002';
// Each KIS page holds at most 100 bars; these ranges stay below that.
const ranges = [['20230801', '20231215'], ['20231216', '20240510'], ['20240511', '20240930'], ['20241001', '20250220'],
  ['20250221', '20250715'], ['20250716', '20251205'], ['20251206', '20260430'], ['20260501', through]];
const bySymbol = new Map(); const errors = [];
for (const [index, [code]] of SYMBOLS.entries()) {
  const rows = new Map();
  for (const [from, to] of ranges) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const query = new URLSearchParams({ FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: code, FID_INPUT_DATE_1: from, FID_INPUT_DATE_2: to,
          FID_PERIOD_DIV_CODE: 'D', FID_ORG_ADJ_PRC: '1' });
        const body = (await session.get(`/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice?${query}`, 'FHKST03010100')).body;
        for (const row of body.output2 ?? []) if (row.stck_bsop_date) rows.set(row.stck_bsop_date, { date: row.stck_bsop_date, open: row.stck_oprc,
          high: row.stck_hgpr, low: row.stck_lwpr, close: row.stck_clpr, volume: row.acml_vol });
        break;
      } catch (error) {
        if (attempt === 3) errors.push([code, from, error?.code ?? error?.name ?? 'unknown']);
        else await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  }
  bySymbol.set(code, [...rows.values()].sort((a, b) => a.date.localeCompare(b.date)));
  if (index % 20 === 0) process.stderr.write(`${index}/${SYMBOLS.length}\n`);
}
const counts = new Map();
for (const candles of bySymbol.values()) { const key = candles.map((c) => c.date).join(); counts.set(key, (counts.get(key) ?? 0) + 1); }
const sessions = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0].split(',');
const series = []; const excluded = [];
for (const [symbol, candles] of bySymbol) {
  if (candles.map((c) => c.date).join() === sessions.join()) series.push({ symbol, candles }); else excluded.push([symbol, candles.length]);
}
process.stdout.write(JSON.stringify({ source: `KIS FHKST03010100 J raw low-price research ${sessions[0]}-${sessions.at(-1)} retrieved ${new Date().toISOString()}`,
  timezone: 'Asia/Seoul', priceBasis: 'raw', sessions, series }));
process.stderr.write(JSON.stringify({ sessions: sessions.length, included: series.length, excluded, errors }) + '\n');

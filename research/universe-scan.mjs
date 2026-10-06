// Research-only scan (not production): latest price and 20-session turnover per listed common stock, to pick a
// low-price, liquid research universe. Runs inside the server container (paper runtime, `/app/dist`), one KIS
// daily-chart call per symbol at the configured pacing. Candidates come from the DART corp list; the runner
// prepends `const CANDIDATES = [[code, name], ...];` to this file. Usage: FROM=YYYYMMDD THROUGH=YYYYMMDD.
/* global CANDIDATES */
import { createKisSession } from '/app/dist/infrastructure/broker/kis/kisSession.js';

const env = process.env;
if (env.BROKER_MODE !== 'paper' || env.LIVE_TRADING_ENABLED !== 'false') throw new Error('unsafe runtime');
const session = createKisSession({ baseUrl: env.KIS_BASE_URL, appKey: env.KIS_APP_KEY, appSecret: env.KIS_APP_SECRET }, undefined, Date.now, undefined, 1500);
const from = env.FROM ?? '20260901'; const through = env.THROUGH ?? '20261002';
const results = []; const errors = [];
for (const [index, [code, name]] of CANDIDATES.entries()) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const query = new URLSearchParams({ FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: code, FID_INPUT_DATE_1: from, FID_INPUT_DATE_2: through,
        FID_PERIOD_DIV_CODE: 'D', FID_ORG_ADJ_PRC: '1' });
      const body = (await session.get(`/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice?${query}`, 'FHKST03010100')).body;
      const bars = (body.output2 ?? []).filter((row) => row.stck_bsop_date).map((row) => ({ date: row.stck_bsop_date, close: Number(row.stck_clpr), volume: Number(row.acml_vol) }))
        .sort((a, b) => a.date.localeCompare(b.date));
      const last = bars.slice(-20);
      results.push({ code, name, bars: bars.length, through: bars.at(-1)?.date ?? null, close: bars.at(-1)?.close ?? null,
        turnover: last.length ? Math.round(last.reduce((sum, bar) => sum + bar.close * bar.volume, 0) / last.length) : 0,
        zeroVolumeDays: last.filter((bar) => bar.volume === 0).length });
      break;
    } catch (error) {
      if (attempt === 2) errors.push([code, error?.code ?? error?.name ?? 'unknown']);
      else await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
  if (index % 250 === 0) process.stderr.write(`${index}/${CANDIDATES.length} errors=${errors.length}\n`);
}
process.stdout.write(JSON.stringify({ from, through, scanned: CANDIDATES.length, results, errors }));
process.stderr.write(`done results=${results.length} errors=${errors.length}\n`);

// Research-only (not production): ETF momentum rotation for a KRW 500,000 account. Input: RAW per-symbol bars
// (research/fetch-history.mjs RAW=1); each ETF joins once it has enough history. Whole shares, decisions at the
// close, fills at the next open. Costs: commission 2 bp per side, slippage 5 bp; no sell tax on ETFs (simplification).
import { readFileSync } from 'node:fs';

const raw = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const S = [...new Set(raw.series.flatMap((s) => s.candles.map((c) => c.date)))].sort();
const index = new Map(S.map((d, i) => [d, i]));
const jump = (a, b) => a / b > 1.3001 || a / b < 0.6999;
const series = raw.series.filter((s) => s.candles.length > 0 && !s.candles.some((c, i) => i > 0 && (jump(+c.close, +s.candles[i - 1].close) || jump(+c.open, +s.candles[i - 1].close))))
  .map((s) => {
    const o = new Array(S.length).fill(NaN); const c = new Array(S.length).fill(NaN);
    for (const bar of s.candles) { const i = index.get(bar.date); o[i] = +bar.open; c[i] = +bar.close; }
    return { symbol: s.symbol, o, c };
  });
const COMM = 0.0002, SLIP = 0.0005, CAPITAL = 500_000;
const window = (a, t, n) => { const out = a.slice(t - n + 1, t + 1); return out.length === n && out.every(Number.isFinite) ? out : null; };
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

function simulate(p, from, to) {
  let cash = CAPITAL; const pos = new Map(); let peak = cash, mdd = 0, orders = [], trades = 0;
  const value = (t, k) => cash + [...pos].reduce((sum, [i, q]) => sum + q * (Number.isFinite(series[i][k][t]) ? series[i][k][t] : series[i].c[t - 1]), 0);
  for (let t = from; t <= to; t++) {
    for (const o of orders.filter((x) => x.side === 'SELL')) {
      const px = series[o.i].o[t]; if (!pos.has(o.i) || !Number.isFinite(px)) continue;
      cash += pos.get(o.i) * px * (1 - SLIP) * (1 - COMM); pos.delete(o.i); trades++;
    }
    const equity = value(t, 'o');
    for (const o of orders.filter((x) => x.side === 'BUY')) {
      const px = series[o.i].o[t] * (1 + SLIP); if (pos.has(o.i) || pos.size >= p.positions || !Number.isFinite(px)) continue;
      const qty = Math.floor(Math.min(equity * 0.98 / p.positions, cash) / (px * (1 + COMM)));
      if (qty >= 1) { cash -= qty * px * (1 + COMM); pos.set(o.i, qty); }
    }
    orders = [];
    const eq = value(t, 'c'); peak = Math.max(peak, eq); mdd = Math.max(mdd, (peak - eq) / peak);
    if (t === to || (t - from) % p.rebalance !== 0) continue;
    const ranked = series.map((s, i) => {
      const w = window(s.c, t, Math.max(p.lookback, p.trend) + 1);
      if (!w) return null;
      const score = w.at(-1) / w.at(-1 - p.lookback) - 1;
      return { i, score, ok: score > 0 && (p.trend === 0 || w.at(-1) > mean(w.slice(-p.trend))) };
    }).filter((x) => x && x.ok).sort((a, b) => b.score - a.score);
    const keep = new Set(ranked.slice(0, p.positions * 2).map((x) => x.i));
    for (const i of pos.keys()) if (!keep.has(i)) orders.push({ side: 'SELL', i });
    for (const x of ranked.slice(0, p.positions)) if (!pos.has(x.i)) orders.push({ side: 'BUY', i: x.i });
  }
  const final = value(to, 'c'); const days = to - from + 1;
  return { ret: final / CAPITAL - 1, cagr: (final / CAPITAL) ** (250 / days) - 1, mdd, trades };
}

const split = S.indexOf(process.argv[3] ?? '20251001'); const from = S.indexOf(process.argv[4] ?? '20240613');
const grid = [];
for (const lookback of [20, 60, 120]) for (const trend of [0, 60, 120]) for (const positions of [1, 2, 3]) for (const rebalance of [1, 5]) grid.push({ lookback, trend, positions, rebalance });
const fmt = (r) => ({ ret: +r.ret.toFixed(3), mdd: +r.mdd.toFixed(3), trades: r.trades });
const score = (r) => r.trades >= 6 ? r.cagr / Math.max(r.mdd, 0.05) : -Infinity;
const rows = grid.map((p) => ({ p, in: simulate(p, from, split - 1), out: simulate(p, split, S.length - 1) })).sort((a, b) => score(b.in) - score(a.in));
const hold = (symbol, a, b) => { const s = series.find((x) => x.symbol === symbol); return s && Number.isFinite(s.o[a]) ? +(s.c[b] / s.o[a] - 1).toFixed(3) : null; };
const out = rows.map((r) => r.out.ret).sort((a, b) => a - b);
console.log(JSON.stringify({ windows: { in: [S[from], S[split - 1]], out: [S[split], S.at(-1)] }, etfs: series.length,
  benchmarks: Object.fromEntries(['361580', '229200', '360750'].map((s) => [s, { in: hold(s, from, split - 1), out: hold(s, split, S.length - 1) }])),
  top8ByInSample: rows.slice(0, 8).map((r) => ({ p: r.p, in: fmt(r.in), out: fmt(r.out) })),
  outMedianRet: +out[Math.floor(out.length / 2)].toFixed(3), outPositiveShare: +(out.filter((x) => x > 0).length / out.length).toFixed(2) }, null, 1));

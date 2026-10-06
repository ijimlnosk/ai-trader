// Research-only (not production): momentum rotation sized for a small account. Whole shares only.
// Decisions at close t use data <= t; fills at open t+1. Costs: commission 2 bp per side, sell tax 20 bp,
// slippage 5 bp. Same data and windows as research/intraday-thresholds.mjs.
import { readFileSync } from 'node:fs';

const data = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const jump = (a, b) => a / b > 1.3001 || a / b < 0.6999;
const excluded = new Set(data.series.filter((s) => s.candles.some((c, i) => i > 0
  && (jump(+c.close, +s.candles[i - 1].close) || jump(+c.open, +s.candles[i - 1].close)))).map((s) => s.symbol));
const S = data.sessions; const T = S.length;
const series = data.series.filter((s) => !excluded.has(s.symbol)).map((s) => ({ symbol: s.symbol, o: s.candles.map((c) => +c.open), c: s.candles.map((c) => +c.close) }));
const COST = { comm: 0.0002, tax: 0.002, slip: 0.0005 };
const sma = (a, t, n) => { if (t + 1 < n) return NaN; let s = 0; for (let i = t - n + 1; i <= t; i++) s += a[i]; return s / n; };

// p: { capital, positions, weight, fill, keepRank, trimAbove }. `fill` walks down the ranking (within keepRank)
// past symbols one share of which does not fit the budget; otherwise only the top `positions` ranks are eligible.
function simulate(p, from, to) {
  let cash = p.capital; const pos = new Map(); const trades = []; let peak = cash, mdd = 0, orders = [], investedSum = 0, idle = 0;
  const equityAt = (t, k) => cash + [...pos].reduce((sum, [i, q]) => sum + q.qty * series[i][k][t], 0);
  for (let t = from; t <= to; t++) {
    for (const o of orders.sort((a, b) => (a.side === 'BUY') - (b.side === 'BUY'))) {
      const s = series[o.i]; const q = pos.get(o.i);
      if (o.side !== 'BUY' && q) {
        const keep = o.side === 'SELL' ? 0 : Math.floor(equityAt(t, 'o') * p.weight / s.o[t]);
        // A trim never sells the whole position (same rule as the production trim).
        if (o.side === 'TRIM' && keep < 1) continue;
        const qty = q.qty - keep; if (qty < 1) continue;
        const net = qty * s.o[t] * (1 - COST.slip) * (1 - COST.comm - COST.tax); const cost = q.cost * qty / q.qty;
        cash += net; q.cost -= cost; q.qty -= qty; if (q.qty === 0) { pos.delete(o.i); trades.push((net - cost) / cost); }
      }
      if (o.side === 'BUY' && !q && pos.size < p.positions) {
        const fill = s.o[t] * (1 + COST.slip); const qty = Math.floor(Math.min(equityAt(t, 'o') * p.weight, cash) / (fill * (1 + COST.comm)));
        if (qty >= 1) { const cost = qty * fill * (1 + COST.comm); cash -= cost; pos.set(o.i, { qty, cost }); }
      }
    }
    orders = [];
    const eq = equityAt(t, 'c'); peak = Math.max(peak, eq); mdd = Math.max(mdd, (peak - eq) / peak);
    investedSum += 1 - cash / eq; if (pos.size === 0) idle++;
    if (t === to) continue;
    const ranked = series.map((s, i) => ({ i, score: s.c[t] / s.c[t - 120] - 1, ok: t >= 120 && s.c[t] > sma(s.c, t, 120) }))
      .filter((x) => x.ok && x.score > 0).sort((a, b) => b.score - a.score);
    const rank = new Map(ranked.map((x, r) => [x.i, r]));
    for (const [i, q] of pos) {
      if (!(series[i].c[t] > sma(series[i].c, t, 120)) || !rank.has(i) || rank.get(i) >= p.keepRank) orders.push({ side: 'SELL', i });
      else if (q.qty * series[i].c[t] > eq * p.trimAbove) orders.push({ side: 'TRIM', i });
    }
    const budget = eq * p.weight;
    const pool = p.fill ? ranked.slice(0, p.keepRank).filter((x) => series[x.i].c[t] * (1 + COST.slip + COST.comm) <= budget) : ranked.slice(0, p.positions);
    for (const x of pool.slice(0, p.positions)) if (!pos.has(x.i)) orders.push({ side: 'BUY', i: x.i });
  }
  const final = equityAt(to, 'c'); const days = to - from + 1;
  return { ret: final / p.capital - 1, mdd, trades: trades.length, win: trades.length ? trades.filter((x) => x > 0).length / trades.length : null,
    invested: investedSum / days, idle: idle / days, cagr: (final / p.capital) ** (250 / days) - 1 };
}

const warm = 260; const split = S.indexOf(process.argv[3] ?? '20251001');
const windows = { in: [warm, split - 1], out: [split, T - 1] };
const variants = [];
for (const capital of (process.env.CAPITALS ?? '500000,10000000').split(',').map(Number)) for (const [positions, weight] of [[5, 0.09], [3, 0.3], [2, 0.45], [1, 0.95]]) for (const fill of [false, true]) {
  variants.push({ capital, positions, weight, fill, keepRank: 10, trimAbove: positions === 1 ? Infinity : Math.min(0.99, weight * 5 / 3) });
}
const fmt = (r) => ({ ret: +r.ret.toFixed(3), mdd: +r.mdd.toFixed(3), trades: r.trades, win: r.win === null ? null : +r.win.toFixed(2),
  invested: +r.invested.toFixed(2), idle: +r.idle.toFixed(2) });
const score = (r) => r.trades >= 10 ? r.cagr / Math.max(r.mdd, 0.05) : -Infinity;
const rows = variants.map((p) => ({ p, in: simulate(p, ...windows.in), out: simulate(p, ...windows.out) }));
console.log(JSON.stringify({ windows: { in: [S[windows.in[0]], S[windows.in[1]]], out: [S[windows.out[0]], S[windows.out[1]]], symbols: series.length },
  rows: rows.map((r) => ({ p: r.p, score: +score(r.in).toFixed(2), in: fmt(r.in), out: fmt(r.out) })) }, null, 1));

// Research-only (not production): short-holding strategies for a small account on daily bars. Whole shares.
// Decisions use data <= close t; fills at open t+1, or at that day's close for same-day exits (closing auction).
// Costs: commission 2 bp per side, sell tax 20 bp, slippage SLIP bp per fill (default 10, low-price stocks).
import { readFileSync } from 'node:fs';

const data = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const jump = (a, b) => a / b > 1.3001 || a / b < 0.6999;
const excluded = new Set(data.series.filter((s) => s.candles.some((c, i) => i > 0
  && (jump(+c.close, +s.candles[i - 1].close) || jump(+c.open, +s.candles[i - 1].close)))).map((s) => s.symbol));
const S = data.sessions; const T = S.length;
const series = data.series.filter((s) => !excluded.has(s.symbol)).map((s) => ({ symbol: s.symbol, o: s.candles.map((c) => +c.open),
  h: s.candles.map((c) => +c.high), l: s.candles.map((c) => +c.low), c: s.candles.map((c) => +c.close), v: s.candles.map((c) => +c.volume) }));
const SLIP = Number(process.env.SLIP ?? 10) / 10000; const COMM = 0.0002, TAX = 0.002;
const sma = (a, t, n) => { if (t + 1 < n) return NaN; let s = 0; for (let i = t - n + 1; i <= t; i++) s += a[i]; return s / n; };
function rsi2(c, t) {
  if (t < 30) return NaN; let up = 0, down = 0;
  for (let i = t - 29; i <= t; i++) { const d = c[i] - c[i - 1]; const a = 0.5; up = a * Math.max(d, 0) + (1 - a) * up; down = a * Math.max(-d, 0) + (1 - a) * down; }
  return down === 0 ? 100 : 100 - 100 / (1 + up / down);
}

// A strategy returns ranked entry candidates at close t, an exit test for held positions at close t, and
// whether entries are closed at the same day's close (day trade).
const strategies = {
  rsi2: ({ threshold, trend, maxHold }) => ({
    entries: (t) => series.map((s, i) => ({ i, key: rsi2(s.c, t) })).filter((x) => x.key < threshold && series[x.i].c[t] > sma(series[x.i].c, t, trend))
      .sort((a, b) => a.key - b.key),
    exit: (i, t, entry) => series[i].c[t] > sma(series[i].c, t, 5) || t - entry >= maxHold }),
  breakout: ({ surge, hold }) => ({
    entries: (t) => series.map((s, i) => ({ i, key: s.v[t] / sma(s.v, t - 1, 20) })).filter((x) => {
      const s = series[x.i]; return t > 60 && s.c[t] >= Math.max(...s.c.slice(t - 19, t + 1)) && x.key >= surge && s.c[t] > sma(s.c, t, 60);
    }).sort((a, b) => b.key - a.key),
    exit: (_i, t, entry) => t - entry >= hold }),
  // Day trade: decided on the previous close, bought at the open, sold at the same day's close.
  dayAfter: ({ move, surge }) => ({ sameDay: true,
    entries: (t) => series.map((s, i) => ({ i, key: s.c[t] / s.c[t - 1] - 1 })).filter((x) => t > 21 && (move > 0 ? x.key >= move : x.key <= move)
      && series[x.i].v[t] >= surge * sma(series[x.i].v, t - 1, 20)).sort((a, b) => Math.abs(b.key) - Math.abs(a.key)) }),
};

function simulate(strategy, sizing, from, to) {
  let cash = 500_000; const pos = new Map(); const trades = []; let peak = cash, mdd = 0, orders = [];
  const equity = (t, k) => cash + [...pos].reduce((sum, [i, q]) => sum + q.qty * series[i][k][t], 0);
  const sell = (i, px) => { const q = pos.get(i); const net = q.qty * px * (1 - SLIP) * (1 - COMM - TAX); cash += net; trades.push((net - q.cost) / q.cost); pos.delete(i); };
  for (let t = from; t <= to; t++) {
    for (const o of orders.filter((x) => x.side === 'SELL')) if (pos.has(o.i)) sell(o.i, series[o.i].o[t]);
    const budgetEquity = equity(t, 'o');
    for (const o of orders.filter((x) => x.side === 'BUY')) {
      if (pos.has(o.i) || pos.size >= sizing.positions) continue;
      const fill = series[o.i].o[t] * (1 + SLIP); const qty = Math.floor(Math.min(budgetEquity * sizing.weight, cash) / (fill * (1 + COMM)));
      if (qty >= 1) { const cost = qty * fill * (1 + COMM); cash -= cost; pos.set(o.i, { qty, cost, entry: t }); }
    }
    orders = [];
    if (strategy.sameDay) for (const [i] of [...pos]) sell(i, series[i].c[t]);
    const eq = equity(t, 'c'); peak = Math.max(peak, eq); mdd = Math.max(mdd, (peak - eq) / peak);
    if (t === to) continue;
    for (const [i, q] of pos) if (strategy.exit(i, t, q.entry)) orders.push({ side: 'SELL', i });
    for (const x of strategy.entries(t).slice(0, sizing.positions)) if (!pos.has(x.i)) orders.push({ side: 'BUY', i: x.i });
  }
  for (const [i] of [...pos]) sell(i, series[i].c[to]);
  const days = to - from + 1;
  return { ret: cash / 500_000 - 1, cagr: (cash / 500_000) ** (250 / days) - 1, mdd, trades: trades.length,
    win: trades.length ? trades.filter((x) => x > 0).length / trades.length : null, avgTrade: trades.length ? trades.reduce((a, b) => a + b, 0) / trades.length : null };
}

const grid = [];
for (const threshold of [5, 10]) for (const trend of [120, 200]) for (const maxHold of [3, 5]) grid.push(['rsi2', { threshold, trend, maxHold }]);
for (const surge of [2, 3]) for (const hold of [1, 3, 5]) grid.push(['breakout', { surge, hold }]);
for (const move of [0.05, 0.1, -0.05, -0.1]) for (const surge of [1, 2]) grid.push(['dayAfter', { move, surge }]);
const sizings = [{ positions: 5, weight: 0.10 }, { positions: 3, weight: 0.30 }, { positions: 2, weight: 0.45 }];
const warm = 210; const split = S.indexOf(process.argv[3] ?? '20251001');
const fmt = (r) => ({ ret: +r.ret.toFixed(3), mdd: +r.mdd.toFixed(3), trades: r.trades, win: r.win === null ? null : +r.win.toFixed(2),
  avgTradeBp: r.avgTrade === null ? null : Math.round(r.avgTrade * 10000) });
const score = (r) => r.trades >= 20 ? r.cagr / Math.max(r.mdd, 0.05) : -Infinity;
const rows = [];
for (const [name, params] of grid) for (const sizing of sizings) {
  const strategy = strategies[name](params);
  rows.push({ name, params, sizing, in: simulate(strategy, sizing, warm, split - 1), out: simulate(strategy, sizing, split, T - 1) });
}
rows.sort((a, b) => score(b.in) - score(a.in));
const view = (r) => ({ name: r.name, params: r.params, sizing: r.sizing, in: fmt(r.in), out: fmt(r.out) });
console.log(JSON.stringify({ windows: { in: [S[warm], S[split - 1]], out: [S[split], S[T - 1]] }, symbols: series.length, excluded: [...excluded], slipBp: SLIP * 10000,
  top10ByInSample: rows.slice(0, 10).map(view), outMedianRet: +rows.map((r) => r.out.ret).sort((a, b) => a - b)[Math.floor(rows.length / 2)].toFixed(3),
  outPositiveShare: +(rows.filter((r) => r.out.ret > 0).length / rows.length).toFixed(2) }, null, 1));

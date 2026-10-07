// Research-only (not production): short-holding strategies at KRW 500,000 on a point-in-time low-price universe.
// Each month the universe is rebuilt from data known before its first session: last close KRW 1,000–45,000, at least
// 60 bars, traded every one of the last 20 sessions, top 100 by 20-session average traded value. Whole shares;
// decisions at the close, fills at the next open (day trades sell at that day's close). A held stock whose next bar
// gaps beyond ±30% (corporate action in raw prices) is closed at the previous close. Costs: commission 2 bp per side,
// sell tax 20 bp, slippage SLIP bp per fill (default 10). Survivorship: delisted stocks are absent from the input.
import { readFileSync } from 'node:fs';

const raw = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const S = [...new Set(raw.series.flatMap((s) => s.candles.map((c) => c.date)))].sort();
const at = new Map(S.map((d, i) => [d, i]));
const T = S.length;
const series = raw.series.map((s) => {
  const z = () => new Float64Array(T).fill(NaN);
  const x = { symbol: s.symbol, o: z(), h: z(), l: z(), c: z(), v: z() };
  for (const b of s.candles) { const i = at.get(b.date); x.o[i] = +b.open; x.h[i] = +b.high; x.l[i] = +b.low; x.c[i] = +b.close; x.v[i] = +b.volume; }
  return x;
});
const SLIP = Number(process.env.SLIP ?? 10) / 10000; const COMM = 0.0002, TAX = 0.002;
const ok = Number.isFinite;
const lastN = (a, t, n) => { const out = []; for (let i = t - n + 1; i <= t; i++) { if (i < 0 || !ok(a[i])) return null; out.push(a[i]); } return out; };
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const gap = (s, t) => t > 0 && ok(s.c[t - 1]) && ok(s.o[t]) && (s.o[t] / s.c[t - 1] > 1.3001 || s.o[t] / s.c[t - 1] < 0.6999);

// Universe per month, built from bars strictly before the month's first session.
const universeAt = new Array(T);
let current = [];
for (let t = 1; t < T; t++) {
  if (S[t].slice(0, 6) !== S[t - 1].slice(0, 6)) {
    current = series.map((s, i) => {
      const c = lastN(s.c, t - 1, 60); const v = lastN(s.v, t - 1, 20);
      if (!c || !v || v.some((x) => x === 0) || c.at(-1) < 1000 || c.at(-1) > 45000) return null;
      return { i, turnover: mean(c.slice(-20).map((x, k) => x * v[k])) };
    }).filter(Boolean).sort((a, b) => b.turnover - a.turnover).slice(0, 100).map((x) => x.i);
  }
  universeAt[t] = current;
}
function rsi2(c, t) {
  const w = lastN(c, t, 31); if (!w) return NaN; let up = 0, down = 0;
  for (let k = 1; k < w.length; k++) { const d = w[k] - w[k - 1]; up = 0.5 * Math.max(d, 0) + 0.5 * up; down = 0.5 * Math.max(-d, 0) + 0.5 * down; }
  return down === 0 ? 100 : 100 - 100 / (1 + up / down);
}
const strategies = {
  rsi2: ({ threshold, maxHold }) => ({
    entries: (t) => universeAt[t].map((i) => ({ i, key: rsi2(series[i].c, t) })).filter((x) => {
      const w = lastN(series[x.i].c, t, 120); return x.key < threshold && w && w.at(-1) > mean(w);
    }).sort((a, b) => a.key - b.key),
    exit: (i, t, entry) => { const w = lastN(series[i].c, t, 5); return (w && w.at(-1) > mean(w)) || t - entry >= maxHold; } }),
  breakout: ({ surge, hold }) => ({
    entries: (t) => universeAt[t].map((i) => {
      const s = series[i]; const c = lastN(s.c, t, 60); const v = lastN(s.v, t - 1, 20);
      return { i, key: c && v ? s.v[t] / mean(v) : NaN, ok: c && c.at(-1) >= Math.max(...c.slice(-20)) && c.at(-1) > mean(c) };
    }).filter((x) => x.ok && x.key >= surge).sort((a, b) => b.key - a.key),
    exit: (_i, t, entry) => t - entry >= hold }),
  dayAfter: ({ move, surge }) => ({ sameDay: true,
    entries: (t) => universeAt[t].map((i) => {
      const s = series[i]; const v = lastN(s.v, t - 1, 20);
      return { i, key: s.c[t] / s.c[t - 1] - 1, vol: v ? s.v[t] / mean(v) : NaN };
    }).filter((x) => ok(x.key) && (move > 0 ? x.key >= move : x.key <= move) && x.vol >= surge).sort((a, b) => Math.abs(b.key) - Math.abs(a.key)) }),
};

function simulate(strategy, sizing, from, to) {
  let cash = 500_000; const pos = new Map(); const trades = []; let peak = cash, mdd = 0, orders = [];
  const mark = (t, i, k) => { const s = series[i]; return ok(s[k][t]) ? s[k][t] : s.c[t - 1]; };
  const equity = (t, k) => cash + [...pos].reduce((sum, [i, q]) => sum + q.qty * mark(t, i, k), 0);
  const sell = (i, px, costs = true) => { const q = pos.get(i); const net = q.qty * px * (costs ? (1 - SLIP) * (1 - COMM - TAX) : 1); cash += net; trades.push((net - q.cost) / q.cost); pos.delete(i); };
  for (let t = from; t <= to; t++) {
    for (const [i] of [...pos]) if (gap(series[i], t)) sell(i, series[i].c[t - 1], false);
    for (const o of orders.filter((x) => x.side === 'SELL')) if (pos.has(o.i) && ok(series[o.i].o[t])) sell(o.i, series[o.i].o[t]);
    const budgetEquity = equity(t, 'o');
    for (const o of orders.filter((x) => x.side === 'BUY')) {
      const s = series[o.i]; if (pos.has(o.i) || pos.size >= sizing.positions || !ok(s.o[t]) || gap(s, t)) continue;
      const fill = s.o[t] * (1 + SLIP); const qty = Math.floor(Math.min(budgetEquity * sizing.weight, cash) / (fill * (1 + COMM)));
      if (qty >= 1) { const cost = qty * fill * (1 + COMM); cash -= cost; pos.set(o.i, { qty, cost, entry: t }); }
    }
    orders = [];
    if (strategy.sameDay) for (const [i] of [...pos]) if (ok(series[i].c[t])) sell(i, series[i].c[t]);
    const eq = equity(t, 'c'); peak = Math.max(peak, eq); mdd = Math.max(mdd, (peak - eq) / peak);
    if (t === to) continue;
    if (!strategy.sameDay) for (const [i, q] of pos) if (strategy.exit(i, t, q.entry)) orders.push({ side: 'SELL', i });
    for (const x of strategy.entries(t).slice(0, sizing.positions)) if (!pos.has(x.i)) orders.push({ side: 'BUY', i: x.i });
  }
  for (const [i] of [...pos]) sell(i, mark(to, i, 'c'));
  const days = to - from + 1;
  return { ret: cash / 500_000 - 1, cagr: (cash / 500_000) ** (250 / days) - 1, mdd, trades: trades.length,
    win: trades.length ? trades.filter((x) => x > 0).length / trades.length : null, avgTrade: trades.length ? mean(trades) : null };
}

const grid = [];
for (const threshold of [5, 10]) for (const maxHold of [3, 5]) grid.push(['rsi2', { threshold, maxHold }]);
for (const surge of [2, 3]) for (const hold of [1, 3, 5]) grid.push(['breakout', { surge, hold }]);
for (const move of [0.05, 0.1, -0.05, -0.1]) for (const surge of [1, 2]) grid.push(['dayAfter', { move, surge }]);
const sizings = [{ positions: 5, weight: 0.10 }, { positions: 3, weight: 0.30 }, { positions: 2, weight: 0.45 }];
const inFrom = S.indexOf('20240613'), split = S.indexOf(process.argv[3] ?? '20251001');
const fmt = (r) => ({ ret: +r.ret.toFixed(3), mdd: +r.mdd.toFixed(3), trades: r.trades, win: r.win === null ? null : +r.win.toFixed(2),
  avgTradeBp: r.avgTrade === null ? null : Math.round(r.avgTrade * 10000) });
const score = (r) => r.trades >= 20 ? r.cagr / Math.max(r.mdd, 0.05) : -Infinity;
const rows = [];
for (const [name, params] of grid) for (const sizing of sizings) {
  const strategy = strategies[name](params);
  rows.push({ name, params, sizing, in: simulate(strategy, sizing, inFrom, split - 1), out: simulate(strategy, sizing, split, T - 1) });
}
rows.sort((a, b) => score(b.in) - score(a.in));
const median = (a) => { const s = [...a].sort((x, y) => x - y); return +s[Math.floor(s.length / 2)].toFixed(3); };
const view = (r) => ({ name: r.name, params: r.params, sizing: r.sizing, in: fmt(r.in), out: fmt(r.out) });
// Benchmark: equal-weight hold of each month's universe, rebalanced monthly (no costs).
let bench = { in: 1, out: 1 };
for (let t = inFrom + 1; t < T; t++) {
  const u = universeAt[t].filter((i) => ok(series[i].c[t]) && ok(series[i].c[t - 1]) && !gap(series[i], t));
  const r = u.length ? mean(u.map((i) => series[i].c[t] / series[i].c[t - 1])) : 1;
  if (t < split) bench.in *= r; else bench.out *= r;
}
console.log(JSON.stringify({ windows: { in: [S[inFrom], S[split - 1]], out: [S[split], S[T - 1]] }, symbols: series.length, slipBp: SLIP * 10000,
  universeExample: { [S[split]]: universeAt[split].length },
  benchmarkEqualWeightUniverse: { in: +(bench.in - 1).toFixed(3), out: +(bench.out - 1).toFixed(3) },
  byFamily: Object.fromEntries(Object.keys(strategies).map((name) => {
    const family = rows.filter((r) => r.name === name);
    return [name, { configs: family.length, inMedianRet: median(family.map((r) => r.in.ret)), outMedianRet: median(family.map((r) => r.out.ret)),
      outPositiveShare: +(family.filter((r) => r.out.ret > 0).length / family.length).toFixed(2), bestInSample: view(family[0]) }];
  })),
  top5ByInSample: rows.slice(0, 5).map(view) }, null, 1));

// Research-only simulator (not production). Decisions at close t use data <= t; fills at open t+1.
// Costs: commission 2 bp per side, sell tax 20 bp, slippage 5 bp. Max 5 positions, 10% each.
import { readFileSync } from 'node:fs';

const data = JSON.parse(readFileSync(process.argv[2], 'utf8'));
// Exclude symbols with moves beyond the KRX ±30% daily limit: raw prices hide corporate actions.
const EXCLUDE = new Set(data.series.filter((s) => s.candles.some((c, i) => i > 0 && (+c.close / +s.candles[i - 1].close > 1.3001 || +c.close / +s.candles[i - 1].close < 0.6999
  || +c.open / +s.candles[i - 1].close > 1.3001 || +c.open / +s.candles[i - 1].close < 0.6999))).map((s) => s.symbol));
data.series = data.series.filter((s) => !EXCLUDE.has(s.symbol));
process.stderr.write('excluded for corporate actions: ' + [...EXCLUDE].join(',') + '\n');
const S = data.sessions; const T = S.length;
const series = data.series.map((s) => ({ symbol: s.symbol, o: s.candles.map((c) => +c.open), h: s.candles.map((c) => +c.high),
  l: s.candles.map((c) => +c.low), c: s.candles.map((c) => +c.close) }));
const COST = { comm: 0.0002, tax: 0.002, slip: 0.0005 };
const MAX_POS = 5, WEIGHT = 0.10;

const sma = (a, t, n) => { if (t + 1 < n) return NaN; let s = 0; for (let i = t - n + 1; i <= t; i++) s += a[i]; return s / n; };
const hi = (a, t, n) => { if (t < n) return NaN; let m = -Infinity; for (let i = t - n; i < t; i++) m = Math.max(m, a[i]); return m; }; // prior n days
const lo = (a, t, n) => { if (t < n) return NaN; let m = Infinity; for (let i = t - n; i < t; i++) m = Math.min(m, a[i]); return m; };
// Equal-weight index of close / first close, for the market filter.
const index = S.map((_, t) => series.reduce((sum, s) => sum + s.c[t] / s.c[0], 0) / series.length);

function simulate(strategy, from, to) {
  let cash = 1e7; const pos = new Map(); const trades = []; let peak = 1e7, mdd = 0; let orders = [];
  let exposureSum = 0, days = 0;
  const equityAt = (t, price) => cash + [...pos].reduce((sum, [i, p]) => sum + p.qty * series[i][price][t], 0);
  for (let t = from; t <= to; t++) {
    // 1) Execute yesterday's orders at today's open: sells first.
    for (const order of orders.sort((a, b) => (a.side === b.side ? 0 : a.side === "SELL" ? -1 : 1))) {
      const s = series[order.i];
      if (order.side === 'SELL') {
        const p = pos.get(order.i); if (!p) continue;
        const px = s.o[t] * (1 - COST.slip); const net = p.qty * px * (1 - COST.comm - COST.tax);
        cash += net; trades.push((net - p.cost) / p.cost); pos.delete(order.i);
      } else {
        if (pos.has(order.i) || pos.size >= MAX_POS) continue;
        const px = s.o[t] * (1 + COST.slip); const eq = equityAt(t, 'o');
        const qty = Math.floor(Math.min(eq * WEIGHT, cash) / (px * (1 + COST.comm)));
        if (qty < 1) continue;
        const cost = qty * px * (1 + COST.comm); cash -= cost; pos.set(order.i, { qty, cost, entry: t });
      }
    }
    orders = [];
    // 2) Mark to close.
    const eq = equityAt(t, 'c'); peak = Math.max(peak, eq); mdd = Math.max(mdd, (peak - eq) / peak);
    exposureSum += 1 - cash / eq; days++;
    // 3) Decide at close for tomorrow's open.
    if (t < to) orders = strategy(t, pos);
  }
  const final = equityAt(to, 'c');
  const years = (to - from + 1) / 250;
  return { ret: final / 1e7 - 1, cagr: (final / 1e7) ** (1 / years) - 1, mdd, trades: trades.length,
    win: trades.length ? trades.filter((x) => x > 0).length / trades.length : null, exposure: exposureSum / days };
}

function buyHold(from, to) {
  const r = series.map((s) => (s.c[to] * (1 - COST.slip - COST.comm - COST.tax)) / (s.o[from] * (1 + COST.slip + COST.comm)) - 1);
  return r.reduce((a, b) => a + b, 0) / r.length;
}

const strategies = {
  // Cross-sectional momentum rotation with trend filter.
  momentum: ({ lookback, rebalance, trendMa, marketMa, keepRank }) => (t, pos) => {
    const orders = [];
    const marketOk = !marketMa || index[t] > sma(index, t, marketMa);
    // Daily protective exit: close below trend MA.
    for (const [i] of pos) if (series[i].c[t] < sma(series[i].c, t, trendMa)) orders.push({ side: 'SELL', i });
    if (t % rebalance !== 0) return orders;
    const ranked = series.map((s, i) => ({ i, score: s.c[t] / s.c[t - lookback] - 1, ok: t >= lookback && s.c[t] > sma(s.c, t, trendMa) }))
      .filter((x) => x.ok && x.score > 0).sort((a, b) => b.score - a.score);
    const rank = new Map(ranked.map((x, r) => [x.i, r]));
    for (const [i] of pos) if (!rank.has(i) || rank.get(i) >= keepRank) if (!orders.some((o) => o.i === i)) orders.push({ side: 'SELL', i });
    if (marketOk) for (const x of ranked.slice(0, MAX_POS)) if (!pos.has(x.i)) orders.push({ side: 'BUY', i: x.i });
    return orders;
  },
  // Donchian breakout trend-following.
  breakout: ({ entry, exit, trendMa, marketMa }) => (t, pos) => {
    const orders = [];
    const marketOk = !marketMa || index[t] > sma(index, t, marketMa);
    for (const [i] of pos) if (series[i].c[t] < lo(series[i].l, t, exit)) orders.push({ side: 'SELL', i });
    if (!marketOk) return orders;
    const candidates = series.map((s, i) => ({ i, strength: s.c[t] / hi(s.h, t, entry) - 1,
      ok: s.c[t] > hi(s.h, t, entry) && s.c[t] > sma(s.c, t, trendMa) })).filter((x) => x.ok && !pos.has(x.i))
      .sort((a, b) => b.strength - a.strength);
    for (const x of candidates) orders.push({ side: 'BUY', i: x.i });
    return orders;
  },
};

const grid = {
  momentum: [],
  breakout: [],
};
for (const lookback of [60, 120, 250]) for (const rebalance of [5, 20]) for (const trendMa of [60, 120]) for (const marketMa of [0, 100])
  for (const keepRank of [5, 10]) grid.momentum.push({ lookback, rebalance, trendMa, marketMa, keepRank });
for (const entry of [20, 55]) for (const exit of [10, 20]) for (const trendMa of [60, 120, 200]) for (const marketMa of [0, 100])
  grid.breakout.push({ entry, exit, trendMa, marketMa });

const warm = 260; // longest lookback
const split = S.indexOf(process.argv[3] ?? '20251001');
const inFrom = warm, inTo = split - 1, outFrom = split, outTo = T - 1;
const results = [];
for (const [name, params] of Object.entries(grid)) for (const p of params) {
  const inS = simulate(strategies[name](p), inFrom, inTo);
  const outS = simulate(strategies[name](p), outFrom, outTo);
  results.push({ name, p, inS, outS });
}
// Select on in-sample only: best Calmar-like score (CAGR / max(MDD, 5%)), minimum 10 trades.
const score = (r) => r.inS.trades >= 10 ? r.inS.cagr / Math.max(r.inS.mdd, 0.05) : -Infinity;
results.sort((a, b) => score(b) - score(a));
const fmt = (x) => x === null ? null : +x.toFixed(4);
const view = (r) => ({ name: r.name, p: r.p, in: Object.fromEntries(Object.entries(r.inS).map(([k, v]) => [k, fmt(v)])),
  out: Object.fromEntries(Object.entries(r.outS).map(([k, v]) => [k, fmt(v)])) });
console.log(JSON.stringify({
  windows: { inSample: [S[inFrom], S[inTo]], outOfSample: [S[outFrom], S[outTo]], symbols: series.length },
  benchmark: { inSampleEqualWeight: fmt(buyHold(inFrom, inTo)), outOfSampleEqualWeight: fmt(buyHold(outFrom, outTo)) },
  top5ByInSample: results.slice(0, 5).map(view),
  bestPerFamily: Object.keys(grid).map((n) => view(results.find((r) => r.name === n))),
  outOfSampleMedianAll: fmt(results.map((r) => r.outS.ret).sort((a, b) => a - b)[Math.floor(results.length / 2)]),
}, null, 1));

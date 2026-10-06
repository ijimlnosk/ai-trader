// Research-only daily-bar proxy (not production) for intraday thresholds. A touch of the day's high/low
// is assumed to fill at the threshold, or at the open when the open already gaps past it. When a stop
// and a target are both touched on one day, the stop is assumed first (conservative). Levels use only
// prices known before the day (entry basis, previous close), so there is no look-ahead in the trigger.
// Costs: commission 2 bp per side, sell tax 20 bp, slippage 5 bp. Start equity KRW 10,000,000.
import { readFileSync } from 'node:fs';

const data = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const jump = (a, b) => a / b > 1.3001 || a / b < 0.6999;
const excluded = new Set(data.series.filter((s) => s.candles.some((c, i) => i > 0
  && (jump(+c.close, +s.candles[i - 1].close) || jump(+c.open, +s.candles[i - 1].close)))).map((s) => s.symbol));
const S = data.sessions; const T = S.length;
const series = data.series.filter((s) => !excluded.has(s.symbol)).map((s) => ({ o: s.candles.map((c) => +c.open),
  h: s.candles.map((c) => +c.high), l: s.candles.map((c) => +c.low), c: s.candles.map((c) => +c.close) }));
const COST = { comm: 0.0002, tax: 0.002, slip: 0.0005 };
// Production momentum (decision 0016): lookback/trend 120, daily, entry top 5, keep top 10, 9% each, trim above 15%.
const M = { lookback: 120, trendMa: 120, entryRanks: 5, keepRank: 10, weight: 0.09, trimAbove: 0.15, maxPos: 5 };
const sma = (a, t, n) => { if (t + 1 < n) return NaN; let s = 0; for (let i = t - n + 1; i <= t; i++) s += a[i]; return s / n; };

function simulate(rule, from, to) {
  let cash = 1e7; const pos = new Map(); const trades = []; let peak = 1e7, mdd = 0, orders = [], intraday = 0;
  const blockedUntil = new Map();
  const equityAt = (t, k) => cash + [...pos].reduce((sum, [i, p]) => sum + p.qty * series[i][k][t], 0);
  const sell = (i, qty, px) => {
    const p = pos.get(i); const net = qty * px * (1 - COST.slip) * (1 - COST.comm - COST.tax); const cost = p.cost * qty / p.qty;
    cash += net; p.cost -= cost; p.qty -= qty; if (p.qty === 0) { pos.delete(i); trades.push((net - cost) / cost); }
  };
  const buy = (i, budget, px, t) => {
    const fill = px * (1 + COST.slip); const qty = Math.floor(Math.min(budget, cash) / (fill * (1 + COST.comm)));
    if (qty < 1) return; const cost = qty * fill * (1 + COST.comm); cash -= cost;
    pos.set(i, { qty, cost, basis: fill, entry: t, partial: false });
  };
  for (let t = from; t <= to; t++) {
    for (const o of orders.sort((a, b) => (a.side === 'BUY') - (b.side === 'BUY'))) {
      const p = pos.get(o.i); const s = series[o.i];
      if (o.side === 'SELL' && p) sell(o.i, p.qty, s.o[t]);
      if (o.side === 'TRIM' && p) { const keep = Math.floor(equityAt(t, 'o') * M.weight / s.o[t]); if (keep >= 1 && keep < p.qty) sell(o.i, p.qty - keep, s.o[t]); }
      if (o.side === 'BUY' && !p && pos.size < M.maxPos) buy(o.i, equityAt(t, 'o') * M.weight, s.o[t], t);
    }
    orders = [];
    if (rule.intraday) intraday += rule.intraday(t, pos, { sell, buy, equityAt, blockedUntil });
    const eq = equityAt(t, 'c'); peak = Math.max(peak, eq); mdd = Math.max(mdd, (peak - eq) / peak);
    for (const [i, p] of pos) if (rule.holdDays && t - p.entry >= rule.holdDays) sell(i, p.qty, series[i].c[t]);
    if (t < to && rule.decide) orders = rule.decide(t, pos, eq, blockedUntil);
  }
  const final = equityAt(to, 'c'); const years = (to - from + 1) / 250;
  return { ret: final / 1e7 - 1, cagr: (final / 1e7) ** (1 / years) - 1, mdd, trades: trades.length, intraday,
    win: trades.length ? trades.filter((x) => x > 0).length / trades.length : null };
}

function momentumDecide(t, pos, eq, blockedUntil) {
  const orders = [];
  const ranked = series.map((s, i) => ({ i, score: s.c[t] / s.c[t - M.lookback] - 1, ok: t >= M.lookback && s.c[t] > sma(s.c, t, M.trendMa) }))
    .filter((x) => x.ok && x.score > 0).sort((a, b) => b.score - a.score);
  const rank = new Map(ranked.map((x, r) => [x.i, r]));
  for (const [i, p] of pos) {
    if (!(series[i].c[t] > sma(series[i].c, t, M.trendMa)) || !rank.has(i) || rank.get(i) >= M.keepRank) orders.push({ side: 'SELL', i });
    else if (p.qty * series[i].c[t] > eq * M.trimAbove) orders.push({ side: 'TRIM', i });
  }
  for (const x of ranked.slice(0, M.entryRanks)) if (!pos.has(x.i) && (blockedUntil.get(x.i) ?? -1) < t) orders.push({ side: 'BUY', i: x.i });
  return orders;
}

// Take profit / stop loss on momentum holdings, measured from the entry fill.
const exits = ({ tp, sl, fraction, cooldown }) => (t, pos, { sell, blockedUntil }) => {
  let n = 0;
  for (const [i, p] of [...pos]) {
    const s = series[i]; const stop = p.basis * (1 - sl); const target = p.basis * (1 + tp);
    if (sl && s.l[t] <= stop) { sell(i, p.qty, Math.min(s.o[t], stop)); blockedUntil.set(i, t + cooldown); n++; continue; }
    if (tp && !p.partial && s.h[t] >= target) {
      const qty = fraction === 1 ? p.qty : Math.floor(p.qty * fraction);
      if (qty < 1) continue; sell(i, qty, Math.max(s.o[t], target)); n++;
      if (pos.has(i)) pos.get(i).partial = true; else blockedUntil.set(i, t + cooldown);
    }
  }
  return n;
};

// Standalone dip buying: buy when the day trades `dip` below the previous close; exit after `hold` closes.
const dipBuy = ({ dip, trend }) => (t, pos, { buy, equityAt }) => {
  let n = 0;
  for (let i = 0; i < series.length && pos.size < M.maxPos; i++) {
    const s = series[i]; const level = s.c[t - 1] * (1 - dip);
    if (pos.has(i) || s.l[t] > level || (trend && !(s.c[t - 1] > sma(s.c, t - 1, 120)))) continue;
    buy(i, equityAt(t - 1, 'c') * 0.10, Math.min(s.o[t], level), t); n++;
  }
  return n;
};

const warm = 260; const split = S.indexOf(process.argv[3] ?? '20251001');
const windows = { in: [warm, split - 1], out: [split, T - 1] };
const fmt = (r) => ({ ret: +r.ret.toFixed(3), mdd: +r.mdd.toFixed(3), trades: r.trades, intraday: r.intraday, win: r.win === null ? null : +r.win.toFixed(2) });
const run = (rule) => ({ in: simulate(rule, ...windows.in), out: simulate(rule, ...windows.out) });
const score = (r) => r.in.trades >= 10 ? r.in.cagr / Math.max(r.in.mdd, 0.05) : -Infinity;

const base = run({ decide: momentumDecide });
const exitRows = [];
for (const tp of [0, 0.1, 0.15, 0.2, 0.3]) for (const sl of [0, 0.05, 0.07, 0.1, 0.15]) for (const fraction of [1, 0.5]) for (const cooldown of [0, 5]) {
  if ((!tp && fraction !== 1) || (!tp && !sl) || (!tp && !sl && cooldown)) continue;
  exitRows.push({ p: { tp, sl, fraction, cooldown }, ...run({ decide: momentumDecide, intraday: exits({ tp, sl, fraction, cooldown }) }) });
}
exitRows.sort((a, b) => score(b) - score(a));
const dipRows = [];
for (const dip of [0.03, 0.05, 0.07, 0.1]) for (const trend of [false, true]) for (const holdDays of [1, 3, 5]) {
  dipRows.push({ p: { dip, trend, holdDays }, ...run({ intraday: dipBuy({ dip, trend }), holdDays }) });
}
dipRows.sort((a, b) => score(b) - score(a));
const view = (r) => ({ p: r.p, in: fmt(r.in), out: fmt(r.out) });
console.log(JSON.stringify({
  windows: { in: [S[windows.in[0]], S[windows.in[1]]], out: [S[windows.out[0]], S[windows.out[1]]], symbols: series.length, excluded: [...excluded] },
  momentumOnly: { in: fmt(base.in), out: fmt(base.out) },
  exitsTop5ByInSample: exitRows.slice(0, 5).map(view),
  exitsSingle: exitRows.filter((r) => r.p.fraction === 1 && !r.p.cooldown && (!r.p.tp || !r.p.sl)).map(view),
  exitsOutMedianRet: +exitRows.map((r) => r.out.ret).sort((a, b) => a - b)[Math.floor(exitRows.length / 2)].toFixed(3),
  dipTop5ByInSample: dipRows.slice(0, 5).map(view),
  dipOutMedianRet: +dipRows.map((r) => r.out.ret).sort((a, b) => a - b)[Math.floor(dipRows.length / 2)].toFixed(3),
}, null, 1));

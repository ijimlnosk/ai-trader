import { DECIMAL_SCALE, parseRiskDecimal } from './risk/decimal.ts';

/** Observed change in a KIS cumulative fill; not an exchange-level execution identifier. */
export interface LedgerExecution {
  orderId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  tradeDate: string;
  quantity: string;
  amount: string;
}
export interface TradeLedger {
  dailyRealizedPnl: string;
  consecutiveLosses: number;
  positions: { symbol: string; quantity: string; costAmount: string }[];
}
export function ledgerDecimal(value: bigint): string {
  const magnitude = value < 0n ? -value : value;
  const fraction = (magnitude % DECIMAL_SCALE).toString().padStart(8, '0').replace(/0+$/, '');
  const result = `${value < 0n ? '-' : ''}${magnitude / DECIMAL_SCALE}${fraction ? `.${fraction}` : ''}`;
  if (parseRiskDecimal(result) === null) throw new Error('Ledger decimal out of range');
  return result;
}
export function ledgerAmount(value: string): bigint {
  const parsed = parseRiskDecimal(value);
  if (parsed === null || parsed < 0n) throw new Error('Invalid ledger amount');
  return parsed;
}
export function validTradeDate(value: string): boolean {
  if (!/^\d{8}$/.test(value)) return false;
  const date = new Date(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6)}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10).replaceAll('-', '') === value;
}
/** Input must be in durable account execution order. No broker valuation is used as cost basis. */
export function calculateTradeLedger(executions: readonly LedgerExecution[], day: string): TradeLedger {
  if (!validTradeDate(day)) throw new Error('Invalid ledger date');
  const holdings = new Map<string, { quantity: bigint; cost: bigint }>();
  const sales = new Map<string, bigint>();
  const identities = new Map<string, string>();
  let daily = 0n;
  let lastDate = '';
  let lastOrder = '';
  for (const execution of executions) {
    const { orderId, symbol, side, tradeDate } = execution;
    if (!orderId || !/^\d{6}$/.test(symbol) || !['BUY', 'SELL'].includes(side)
      || !validTradeDate(tradeDate) || tradeDate < lastDate || tradeDate > day) throw new Error('Invalid ledger sequence');
    const identity = `${symbol}:${side}:${tradeDate}`;
    if (identities.has(orderId) && (identities.get(orderId) !== identity || lastOrder !== orderId)) throw new Error('Invalid ledger order');
    identities.set(orderId, identity); lastOrder = orderId; lastDate = tradeDate;
    const quantity = ledgerAmount(execution.quantity);
    const amount = ledgerAmount(execution.amount);
    if (quantity <= 0n || quantity % DECIMAL_SCALE !== 0n || amount <= 0n) throw new Error('Invalid execution');
    const position = holdings.get(symbol) ?? { quantity: 0n, cost: 0n };
    if (side === 'BUY') {
      position.quantity += quantity; position.cost += amount;
    } else {
      if (quantity > position.quantity) throw new Error('Missing ledger cost basis');
      // Keep division residual in remaining holdings; final disposal consumes every cost unit.
      const cost = quantity === position.quantity ? position.cost : position.cost * quantity / position.quantity;
      const pnl = amount - cost;
      position.quantity -= quantity; position.cost -= cost;
      sales.set(orderId, (sales.get(orderId) ?? 0n) + pnl);
      if (tradeDate === day) daily += pnl;
    }
    holdings.set(symbol, position);
  }
  let consecutiveLosses = 0;
  for (const pnl of sales.values()) consecutiveLosses = pnl < 0n ? consecutiveLosses + 1 : 0;
  return { dailyRealizedPnl: ledgerDecimal(daily), consecutiveLosses,
    positions: [...holdings].filter(([, p]) => p.quantity > 0n).map(([symbol, p]) => ({
      symbol, quantity: ledgerDecimal(p.quantity), costAmount: ledgerDecimal(p.cost),
    })) };
}

export function executionDelta(previousQuantity: string, previousAmount: string, quantity: string, amount: string) {
  const deltaQuantity = ledgerAmount(quantity) - ledgerAmount(previousQuantity);
  const deltaAmount = ledgerAmount(amount) - ledgerAmount(previousAmount);
  if (deltaQuantity < 0n || deltaAmount < 0n || (deltaQuantity === 0n) !== (deltaAmount === 0n)
    || deltaQuantity % DECIMAL_SCALE !== 0n) throw new Error('Invalid cumulative execution change');
  return deltaQuantity === 0n ? null : { quantity: ledgerDecimal(deltaQuantity), amount: ledgerDecimal(deltaAmount) };
}

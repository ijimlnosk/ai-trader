import { asc, eq } from 'drizzle-orm';
import type { ShadowTradeRepository } from '../../application/strategy/shadowDayTrader.ts';
import type { createDatabase } from './index.ts';
import { shadowTrades as table } from './schema.ts';

type Database = ReturnType<typeof createDatabase>['db'];
// numeric(24,8) comes back as e.g. '16.00000000'; virtual fills are whole numbers by construction.
const whole = (value: string) => BigInt(value.split('.')[0]!);

export function createShadowTradeRepository(db: Database): ShadowTradeRepository {
  return {
    async list(strategy) {
      const rows = await db.select().from(table).where(eq(table.strategy, strategy)).orderBy(asc(table.createdAt), asc(table.id));
      return rows.map((row) => ({ sessionDate: row.sessionDate, symbol: row.symbol, side: row.side, quantity: whole(row.quantity),
        quotePrice: whole(row.quotePrice), fillPrice: whole(row.fillPrice), feesKrw: whole(row.feesKrw), reason: row.reason, createdAt: row.createdAt.toISOString() }));
    },
    async record(strategy, trade) {
      await db.insert(table).values({ strategy, sessionDate: trade.sessionDate, symbol: trade.symbol, side: trade.side, quantity: trade.quantity.toString(),
        quotePrice: trade.quotePrice.toString(), fillPrice: trade.fillPrice.toString(), feesKrw: trade.feesKrw.toString(), reason: trade.reason,
        createdAt: new Date(trade.createdAt) });
    },
  };
}

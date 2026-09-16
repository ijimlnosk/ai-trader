import { randomUUID } from 'node:crypto';
import { vi } from 'vitest';
import { OrderError, type OrderRepository } from '../src/application/orders/ports.ts';
import type { ExecutionDependencies } from '../src/application/orders/execute.ts';
import { sameOrderInput } from '../src/application/orders/input.ts';
import type { StoredOrder, CreateOrderRequest } from '../src/domain/orders.ts';
import type { Position, Portfolio } from '../src/domain/portfolio.ts';

export const time = '2026-09-16T01:00:00.000Z';
export const input: CreateOrderRequest = { symbol: '005930', side: 'BUY', quantity: '1', orderType: 'MARKET', confidence: '0.82' };
export const position: Position = { symbol: '005930', name: 'Samsung', quantity: '1', availableQuantity: '1',
  averagePrice: '70000', currentPrice: '70000', evaluationAmount: '70000', profitLoss: '0', profitLossRate: '0' };
export const portfolio: Portfolio = { cash: '10000000', totalEvaluation: '10000000', totalPurchaseAmount: '0',
  totalProfitLoss: '0', totalProfitLossRate: '0', positions: [] };

export function memoryOrders() {
  const rows = new Map<string, StoredOrder>();
  const snapshots: unknown[] = [];
  const repository: OrderRepository = {
    async reserve(key, request) {
      const existing = [...rows.values()].find((row) => row.idempotencyKey === key);
      if (existing) {
        if (!sameOrderInput(existing.request, request)) throw new OrderError('idempotency_conflict');
        return { order: structuredClone(existing), created: false };
      }
      if ([...rows.values()].some((o) => ['PREPARING', 'SUBMITTING', 'UNKNOWN', 'SUBMITTED', 'PARTIALLY_FILLED'].includes(o.brokerStatus)
        || (['FILLED', 'CANCELLED'].includes(o.brokerStatus) && !o.positionsSyncedAt))) throw new OrderError('account_busy');
      const order: StoredOrder = { id: randomUUID(), proposalId: randomUUID(), ...request, request, idempotencyKey: key,
        requestedPrice: null, riskStatus: 'pending', riskReasons: [], brokerOrderId: null, brokerStatus: 'PREPARING',
        filledQuantity: '0', filledAmount: '0', positionsSyncedAt: null, failureCode: null, createdAt: time,
        updatedAt: time, version: 0, audit: null, brokerOrderDate: null };
      rows.set(order.id, structuredClone(order));
      return { order, created: true };
    },
    async get(id) { return structuredClone(rows.get(id) ?? null); },
    async update(order, patch) {
      if (rows.get(order.id)?.version !== order.version) throw new OrderError('order_conflict');
      const updated = { ...order, ...patch, version: order.version + 1 };
      rows.set(order.id, structuredClone(updated));
      return updated;
    },
    async reconcile(order, patch, portfolio) {
      const updated = await repository.update(order, patch);
      snapshots.push(structuredClone(portfolio));
      return updated;
    },
  };
  return { repository, rows, snapshots };
}
export function setupOrders() {
  const memory = memoryOrders();
  const broker = {
    getBuyingPower: vi.fn(async () => ({ cash: '10000000', quantity: '100' })),
    submitOrder: vi.fn<ExecutionDependencies['broker']['submitOrder']>(async () => ({ accepted: true, brokerOrderId: '12345' })),
    getOrderFill: vi.fn<ExecutionDependencies['broker']['getOrderFill']>(async () => ({ brokerOrderId: '12345', orderDate: '20260916',
      symbol: '005930', side: 'BUY', quantity: '1', filledQuantity: '1', filledAmount: '70000', status: 'FILLED' })),
  };
  const market = { isConfigured: () => true, getQuote: vi.fn(async () => ({ symbol: '005930', price: '70000', change: '0', changeRate: '0', volume: '1', timestamp: time })) };
  const account = { getPortfolio: vi.fn(async () => structuredClone(portfolio)) };
  const deps: ExecutionDependencies = { repository: memory.repository, market, account, broker, enabled: true, killSwitchEnabled: false, now: () => new Date(time) };
  return { ...memory, deps, broker, market, account };
}

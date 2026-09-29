import type { StoredOrder, OrderResponse } from '../../domain/orders.ts';
import type { StrategyService } from '../strategy/index.ts';
import type { PaperLoopInput } from './input.ts';

export type LoopStatus = 'CLAIMED' | 'TRACKING' | 'COMPLETE' | 'HALTED';
export interface PaperLoopRun {
  id: string;
  input: PaperLoopInput;
  orderKey: string;
  status: LoopStatus;
  result: Awaited<ReturnType<StrategyService>> | null;
  order: OrderResponse | null;
  reason: string | null;
  deadline: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}
export type LoopPatch = Pick<PaperLoopRun, 'status' | 'result' | 'order' | 'reason'>;
export interface PaperLoopRepository {
  find(runKey: string, orderKey: string): Promise<PaperLoopRun | null>;
  /** Atomic unique account/run key + account/order identity, one active claim per account. */
  claim(input: PaperLoopInput, orderKey: string, deadline: string): Promise<{ run: PaperLoopRun; created: boolean }>;
  update(run: PaperLoopRun, patch: LoopPatch): Promise<PaperLoopRun>;
  findOrder(orderKey: string): Promise<StoredOrder | null>;
  hasUnresolvedOrder(): Promise<boolean>;
}
export class PaperLoopError extends Error {
  constructor(public readonly code: 'loop_disabled' | 'loop_context_unavailable' | 'loop_conflict' | 'loop_busy') { super(code); }
}

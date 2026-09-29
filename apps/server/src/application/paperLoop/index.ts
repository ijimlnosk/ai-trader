import { isDeepStrictEqual } from 'node:util';
import type { StrategyService } from '../strategy/index.ts';
import type { OrderServices } from '../orders/index.ts';
import { eligibleLoopSession, loopOrderKey, paperLoopInputSchema } from './input.ts';
import { PaperLoopError, type PaperLoopRepository } from './ports.ts';
import { recoverLoop } from './recovery.ts';

export function assertSameLoopInput(a: unknown, b: unknown): void {
  if (!isDeepStrictEqual(a, b)) throw new PaperLoopError('loop_conflict');
}
export function createPaperLoop(deps: {
  repository: PaperLoopRepository; strategy: StrategyService; orders: OrderServices;
  enabled: boolean; executionEnabled: boolean; now?: () => Date;
}) {
  const now = deps.now ?? (() => new Date());
  return async (raw: unknown) => {
    const input = paperLoopInputSchema.parse(raw);
    const key = loopOrderKey(input);
    const existing = await deps.repository.find(input.runKey, key);
    if (existing) {
      assertSameLoopInput(existing.input, input);
      return recoverLoop(existing, deps.repository, deps.orders, now);
    }
    if (!deps.enabled || !deps.executionEnabled) throw new PaperLoopError('loop_disabled');
    if (!eligibleLoopSession(input, now())) throw new PaperLoopError('loop_context_unavailable');
    if (await deps.repository.hasUnresolvedOrder()) throw new PaperLoopError('loop_busy');
    const claimed = await deps.repository.claim(input, key, new Date(now().getTime() + 120000).toISOString());
    assertSameLoopInput(claimed.run.input, input);
    if (!claimed.created) return claimed.run;
    let run = claimed.run;
    if (await deps.repository.findOrder(key)) return recoverLoop(run, deps.repository, deps.orders, now);
    try {
      const result = await deps.strategy(input.data, '005930');
      run = await deps.repository.update(run, { result, order: result.order, reason: null,
        status: result.order ? 'TRACKING' : 'COMPLETE' });
    } catch {
      // Persist a durable halt, including when the strategy's order acknowledgement was lost.
      // If this write also fails, the CLAIMED row still prevents another submission.
      run = await deps.repository.update(run, { result: null, order: null, status: 'HALTED', reason: 'evaluation_or_persistence_failed' });
    }
    return recoverLoop(run, deps.repository, deps.orders, now);
  };
}
export type PaperLoop = ReturnType<typeof createPaperLoop>;

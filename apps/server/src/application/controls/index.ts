import type { ConsoleControlsResponse } from '@ai-trader/contracts';
import type { AuthService } from '../auth/index.ts';
import type { SessionIdentity } from '../auth/ports.ts';

export interface TradingControlState { enabled: boolean; updatedAt: string | null; updatedByEmail: string | null }
export interface TradingControlEvent { enabled: boolean; at: string; byEmail: string | null }
export interface TradingControlRepository {
  /** A missing row is paused. */
  get(account: string): Promise<TradingControlState>;
  /** Upserts the state and appends an audit event atomically. */
  set(account: string, enabled: boolean, userId: string): Promise<TradingControlState>;
  events(account: string, limit: number): Promise<TradingControlEvent[]>;
}
export class ControlError extends Error {
  constructor(public readonly code: 'control_not_allowed') { super(code); }
}

/**
 * Owner pause/resume of automatic paper trading. The environment remains the master switch:
 * the web can only narrow it, never enable execution, live mode or anything else.
 */
export function createTradingControls(deps: { repository: TradingControlRepository; auth: AuthService; account: string; environmentAllows: boolean }) {
  const { repository, account } = deps;
  return {
    async status(): Promise<ConsoleControlsResponse> {
      const [state, events] = await Promise.all([repository.get(account), repository.events(account, 10)]);
      return { autoTrading: { ...state, environmentAllows: deps.environmentAllows, effective: deps.environmentAllows && state.enabled }, events };
    },
    /** Pausing is always allowed and needs no step-up: it can only reduce trading. */
    async pause(identity: SessionIdentity) { await repository.set(account, false, identity.id); },
    async resume(identity: SessionIdentity, password: unknown) {
      if (!deps.environmentAllows) throw new ControlError('control_not_allowed');
      await deps.auth.reauthenticate(identity, password);
      await repository.set(account, true, identity.id);
    },
    isAutoTradingEnabled: async () => deps.environmentAllows && (await repository.get(account)).enabled,
  };
}
export type TradingControls = ReturnType<typeof createTradingControls>;

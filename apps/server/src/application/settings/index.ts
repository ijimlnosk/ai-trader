import type { ConsoleSettingsResponse } from '@ai-trader/contracts';
import { seoulOrderDate } from '../../domain/orders.ts';
import { nextKrxSession } from '../../domain/scheduler/krxCalendar.ts';
import { DEFAULT_RISK_POLICY, type RiskPolicy } from '../../domain/risk/index.ts';
import { DEFAULT_OWNER_SETTINGS, parseOwnerSettings, type OwnerSettings } from '../../domain/settings/ownerSettings.ts';
import { DAY_PRESETS, ETF_PRESETS } from '../../domain/strategy/presets.ts';
import type { AuthService } from '../auth/index.ts';
import type { SessionIdentity } from '../auth/ports.ts';

export interface StoredSettings { settings: unknown; effectiveFrom: string; createdAt: string; byEmail: string | null }
export interface OwnerSettingsRepository {
  /** Newest row with effectiveFrom <= date (by effectiveFrom, then creation). */
  effectiveOn(account: string, date: string): Promise<StoredSettings | null>;
  /** Newest row with effectiveFrom > date. */
  pendingAfter(account: string, date: string): Promise<StoredSettings | null>;
  history(account: string, limit: number): Promise<StoredSettings[]>;
  insert(account: string, settings: OwnerSettings, effectiveFrom: string, userId: string): Promise<void>;
}
export class SettingsError extends Error {
  constructor(public readonly code: 'invalid_settings' | 'calendar_unknown', public readonly fields: string[] = []) { super(code); }
}

/** A stored row that no longer validates (e.g. a removed preset) falls back to the defaults rather than failing open. */
const valid = (stored: StoredSettings | null): OwnerSettings => {
  const parsed = stored ? parseOwnerSettings(stored.settings) : null;
  return parsed && 'settings' in parsed ? parsed.settings : DEFAULT_OWNER_SETTINGS;
};

/** Today's effective settings (defaults when none apply). Shared by the settings service and the execution path. */
export function createEffectiveSettingsReader(repository: OwnerSettingsRepository, account: string, now: () => Date = () => new Date()) {
  return async (): Promise<OwnerSettings> => valid(await repository.effectiveOn(account, seoulOrderDate(now().toISOString())));
}

/** The owner's risk limits as a Risk Engine policy; validation keeps them at or below the default policy. */
export function riskPolicyFrom(settings: OwnerSettings): Readonly<RiskPolicy> {
  const { risk } = settings;
  const isDefault = Object.entries(risk).every(([key, value]) => DEFAULT_RISK_POLICY[key as keyof RiskPolicy] === value);
  return { ...DEFAULT_RISK_POLICY, ...risk, version: isDefault ? DEFAULT_RISK_POLICY.version : `${DEFAULT_RISK_POLICY.version}-owner` };
}

/**
 * Owner settings with next-session activation. The server switches remain the outer bound: a setting can only
 * narrow what the environment allows. Every change re-asks the password; the rows themselves are the audit trail.
 */
export function createOwnerSettings(deps: { repository: OwnerSettingsRepository; auth: AuthService; account: string;
  environment: OwnerSettings['strategies']; now?: () => Date }) {
  const now = deps.now ?? (() => new Date());
  const today = () => seoulOrderDate(now().toISOString());
  const effective = createEffectiveSettingsReader(deps.repository, deps.account, now);
  const status = async (): Promise<ConsoleSettingsResponse> => {
    const [current, pending, history] = await Promise.all([effective(), deps.repository.pendingAfter(deps.account, today()),
      deps.repository.history(deps.account, 20)]);
    return { effective: current, defaults: DEFAULT_OWNER_SETTINGS, environment: deps.environment,
      pending: pending ? { settings: valid(pending), effectiveFrom: pending.effectiveFrom, createdAt: pending.createdAt, byEmail: pending.byEmail } : null,
      presets: { day: Object.entries(DAY_PRESETS).map(([id, p]) => ({ id, label: p.label })),
        etf: Object.entries(ETF_PRESETS).map(([id, p]) => ({ id, label: p.label, backtest: p.backtest })) },
      history: history.map((row) => ({ settings: valid(row), effectiveFrom: row.effectiveFrom, createdAt: row.createdAt, byEmail: row.byEmail })) };
  };
  return {
    effective, status,
    /** Effective switch: the environment allows it AND the owner has it on. */
    isEnabled: async (key: keyof OwnerSettings['strategies']) => deps.environment[key] && (await effective()).strategies[key],
    async update(identity: SessionIdentity, password: unknown, input: unknown) {
      await deps.auth.reauthenticate(identity, password);
      const parsed = parseOwnerSettings(input);
      if ('errors' in parsed) throw new SettingsError('invalid_settings', parsed.errors);
      const effectiveFrom = nextKrxSession(today());
      if (!effectiveFrom) throw new SettingsError('calendar_unknown');
      await deps.repository.insert(deps.account, parsed.settings, effectiveFrom, identity.id);
      return status();
    },
  };
}
export type OwnerSettingsService = ReturnType<typeof createOwnerSettings>;

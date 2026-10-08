import { describe, expect, it } from 'vitest';
import { DEFAULT_RISK_POLICY } from '../../domain/risk/index.ts';
import { DEFAULT_OWNER_SETTINGS } from '../../domain/settings/ownerSettings.ts';
import { createOwnerSettings, riskPolicyFrom, SettingsError, type StoredSettings } from './index.ts';

const kst = (iso: string) => new Date(`${iso}+09:00`);
function setup(now: Date, environment = { momentumExecution: true, shadowDayTrading: true, shadowEtfRotation: false, takeProfitWatch: true }) {
  const rows: (StoredSettings & { userId: string })[] = []; let clock = now;
  const repository = {
    effectiveOn: async (_a: string, date: string) => rows.filter((r) => r.effectiveFrom <= date).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom) || b.createdAt.localeCompare(a.createdAt))[0] ?? null,
    pendingAfter: async (_a: string, date: string) => rows.filter((r) => r.effectiveFrom > date).at(-1) ?? null,
    history: async () => [...rows].reverse(),
    insert: async (_a: string, settings: unknown, effectiveFrom: string, userId: string) => { rows.push({ settings, effectiveFrom, createdAt: clock.toISOString(), byEmail: 'owner@example.test', userId }); },
  };
  const auth = { reauthenticate: async (_identity: unknown, password: unknown) => { if (password !== 'pw') throw new Error('password_incorrect'); } };
  const service = createOwnerSettings({ repository, auth: auth as never, account: 'acct', environment, now: () => clock });
  return { service, rows, at: (iso: string) => { clock = kst(iso); } };
}
const identity = { id: 'u1', email: 'owner@example.test', executionAccount: 'acct' } as never;

describe('owner settings service', () => {
  it('applies a change from the next session, never the same day', async () => {
    const s = setup(kst('2026-10-08T10:00:00'));
    const next = { ...structuredClone(DEFAULT_OWNER_SETTINGS), dayPreset: 'day-quick' };
    const status = await s.service.update(identity, 'pw', next);
    expect(status.pending).toMatchObject({ effectiveFrom: '20261012', settings: { dayPreset: 'day-quick' } });
    expect(status.effective.dayPreset).toBe('day-v1');
    s.at('2026-10-12T08:00:00');
    expect((await s.service.effective()).dayPreset).toBe('day-quick');
  });

  it('requires the password and rejects looser risk limits without storing anything', async () => {
    const s = setup(kst('2026-10-08T10:00:00'));
    await expect(s.service.update(identity, 'wrong', DEFAULT_OWNER_SETTINGS)).rejects.toThrow('password_incorrect');
    const loose = structuredClone(DEFAULT_OWNER_SETTINGS); (loose.risk as { maxOpenPositions: number }).maxOpenPositions = 6;
    await expect(s.service.update(identity, 'pw', loose)).rejects.toEqual(new SettingsError('invalid_settings', ['risk.maxOpenPositions']));
    expect(s.rows).toHaveLength(0);
  });

  it('keeps the environment as the outer bound', async () => {
    const s = setup(kst('2026-10-08T10:00:00'));
    expect(await s.service.isEnabled('shadowEtfRotation')).toBe(false);
    expect(await s.service.isEnabled('shadowDayTrading')).toBe(true);
  });

  it('maps risk settings to a policy, marking owner changes in the version', () => {
    expect(riskPolicyFrom(DEFAULT_OWNER_SETTINGS)).toEqual(DEFAULT_RISK_POLICY);
    const strict = { ...DEFAULT_OWNER_SETTINGS, risk: { ...DEFAULT_OWNER_SETTINGS.risk, maxOpenPositions: 2 } };
    expect(riskPolicyFrom(strict)).toMatchObject({ version: 'v1-owner', maxOpenPositions: 2, maxDailyLossRate: '0.02' });
  });
});

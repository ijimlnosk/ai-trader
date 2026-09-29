import { describe, expect, it } from 'vitest';
import { paperLoopSetup } from '../../../test/paperLoopSetup.ts';
import { eligibleLoopSession, type PaperLoopInput } from './input.ts';

const base = paperLoopSetup().input;
const tick = (lastBar: string, sessionDate: string): PaperLoopInput =>
  ({ ...base, sessionDate, data: { ...base.data, sessions: [...base.data.sessions.slice(0, -1), lastBar] } });

describe('paper loop session eligibility', () => {
  it('accepts the next reviewed session across a weekend', () => {
    expect(eligibleLoopSession(tick('20260918', '20260921'), new Date('2026-09-21T00:00:00Z'))).toBe(true);
  });

  it('accepts the session after a Monday closure within 96 hours', () => {
    // Friday 10/02 close to Tuesday 10/06 09:00 KST is 89.5 hours.
    expect(eligibleLoopSession(tick('20261002', '20261006'), new Date('2026-10-06T00:00:00Z'))).toBe(true);
  });

  it('rejects the closure day itself and a skipped session', () => {
    expect(eligibleLoopSession(tick('20261002', '20261005'), new Date('2026-10-05T00:00:00Z'))).toBe(false);
    expect(eligibleLoopSession(tick('20260928', '20260930'), new Date('2026-09-30T00:00:00Z'))).toBe(false);
  });

  it('keeps the 96-hour freshness limit after long closures', () => {
    // Thursday 10/08 close, Friday 10/09 closure, Monday 10/12 09:00 KST is 89.5 hours: allowed.
    expect(eligibleLoopSession(tick('20261008', '20261012'), new Date('2026-10-12T00:00:00Z'))).toBe(true);
    // Wednesday 9/23 close to Monday 9/28 09:00 KST (Chuseok) is 113.5 hours: stale, as observed 2026-09-28.
    expect(eligibleLoopSession(tick('20260923', '20260928'), new Date('2026-09-28T00:00:00Z'))).toBe(false);
  });

  it('rejects sessions beyond the reviewed calendar', () => {
    expect(eligibleLoopSession(tick('20261230', '20261231'), new Date('2026-12-31T00:00:00Z'))).toBe(false);
  });
});

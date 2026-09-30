import { describe, expect, it } from 'vitest';


describe('price discontinuity (corporate actions in raw prices)', () => {
  const bar = (date: string, open: string, close: string) => ({ date, open, high: String(Math.max(+open, +close)), low: String(Math.min(+open, +close)), close, volume: '1' });
  it('accepts moves within the ±30% daily limit, including exact limit moves', async () => {
    const { hasPriceDiscontinuity } = await import('./marketData.ts');
    expect(hasPriceDiscontinuity([bar('20260922', '100000', '100000'), bar('20260923', '100000', '130000'), bar('20260924', '120000', '91000')])).toBe(false);
    expect(hasPriceDiscontinuity([bar('20260922', '100000', '100000')])).toBe(false);
  });
  it('flags splits and jumps beyond the limit on the close or the open', async () => {
    const { hasPriceDiscontinuity } = await import('./marketData.ts');
    expect(hasPriceDiscontinuity([bar('20240424', '517000', '517000'), bar('20240425', '114300', '108100')])).toBe(true);
    expect(hasPriceDiscontinuity([bar('20251121', '1221000', '1221000'), bar('20251124', '1797000', '1789000')])).toBe(true);
    expect(hasPriceDiscontinuity([bar('20260922', '100000', '100000'), bar('20260923', '69800', '71000')])).toBe(true);
  });
});

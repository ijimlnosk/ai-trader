/** numeric(24,8): at most 16 integral and 8 fractional digits. No rounding. */
export const DECIMAL_SCALE = 100_000_000n;
export function parseRiskDecimal(value: unknown): bigint | null {
  if (typeof value !== 'string' || value.length > 26
    || !/^[+-]?\d{1,16}(?:\.\d{1,8})?$/.test(value) || value.trim() !== value) return null;
  const negative = value.startsWith('-');
  const [whole = '', fraction = ''] = value.replace(/^[+-]/, '').split('.');
  const magnitude = BigInt(whole) * DECIMAL_SCALE + BigInt(fraction.padEnd(8, '0'));
  return negative ? -magnitude : magnitude;
}

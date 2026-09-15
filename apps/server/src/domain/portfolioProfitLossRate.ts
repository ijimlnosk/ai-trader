// Inputs are validated decimal strings; calculations never convert money to Number.
function decimalParts(value: string) {
  const [whole, fraction = ''] = value.split('.');
  return { coefficient: BigInt(`${whole}${fraction}`), scale: 10n ** BigInt(fraction.length) };
}

/** Percentage to 2 places, half away from zero. Null means undefined return on zero cost. */
export function portfolioProfitLossRate(profitLoss: string, purchaseAmount: string): string | null {
  const profit = decimalParts(profitLoss);
  const purchase = decimalParts(purchaseAmount);
  if (purchase.coefficient === 0n) return profit.coefficient === 0n ? '0.00' : null;
  const negative = profit.coefficient < 0n;
  const absoluteProfit = negative ? -profit.coefficient : profit.coefficient;
  const numerator = absoluteProfit * purchase.scale * 10_000n;
  const denominator = purchase.coefficient * profit.scale;
  let hundredths = numerator / denominator;
  if ((numerator % denominator) * 2n >= denominator) hundredths += 1n;
  return `${negative && hundredths !== 0n ? '-' : ''}${hundredths / 100n}.${String(hundredths % 100n).padStart(2, '0')}`;
}

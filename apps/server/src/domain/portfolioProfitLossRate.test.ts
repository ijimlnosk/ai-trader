import { expect, it } from 'vitest';
import { portfolioProfitLossRate } from './portfolioProfitLossRate.ts';

it.each([
  ['400000', '9800000', '4.08'], ['-400000', '9800000', '-4.08'],
  ['1', '32', '3.13'], ['-1', '32', '-3.13'], ['0.0001', '1000', '0.00'],
  ['-0.0001', '1000', '0.00'], ['0', '0', '0.00'], ['0.00', '0.0000', '0.00'],
  ['1', '0', null], ['-1', '0.00', null], ['1.25', '2.50', '50.00'],
  ['9007199254740993.12345678', '9007199254740993.12345678', '100.00'],
  ['+10.000', '200', '5.00'],
])('computes exact percentage %s / %s = %s', (profit, purchase, expected) => {
  expect(portfolioProfitLossRate(profit, purchase)).toBe(expected);
});

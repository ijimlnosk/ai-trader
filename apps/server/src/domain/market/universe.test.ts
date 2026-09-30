import { expect, it } from 'vitest';
import { UNIVERSE, universeName, universeSymbols } from './universe.ts';

it('is a unique, well-formed universe that keeps the loop symbol first', () => {
  const symbols = universeSymbols();
  expect(symbols[0]).toBe('005930');
  expect(new Set(symbols).size).toBe(symbols.length);
  expect(symbols.every((symbol) => /^\d{6}$/.test(symbol))).toBe(true);
  expect(UNIVERSE.symbols.every(([, name]) => name.trim().length > 0)).toBe(true);
  expect(symbols).toHaveLength(54);
  expect(universeName('000660')).toBe('SK하이닉스');
  expect(universeName('999999')).toBeUndefined();
});

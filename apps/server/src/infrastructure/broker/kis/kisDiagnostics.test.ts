import { expect, it } from 'vitest';
import { kisOperationContext, safeKisMessageCode } from './kisDiagnostics.ts';
import { KIS_PAPER_URL } from './index.ts';

const config = { baseUrl: KIS_PAPER_URL, appKey: 'fixture-key', appSecret: 'fixture-secret', accountNo: '12345678' };
it.each(['APBK0919', 'EGW00123', 'EGW00201'])('preserves bounded KIS message code %s', (value) => {
  expect(safeKisMessageCode(value, config, 'fixture-token')).toBe(value);
});
it.each([undefined, '', '12345678', 'fixture-secret', 'APBK0919\n', 'APBK0919 account=12345678', 'A'.repeat(1000)])('never logs arbitrary provider content %j', (value) => {
  expect(safeKisMessageCode(value, config, 'fixture-token')).toBe('UNRECOGNIZED');
});
it.each(['appKey', 'appSecret', 'accountNo'] as const)('redacts a credential even when %s resembles a code', (field) => {
  expect(safeKisMessageCode('APBK0919', { ...config, [field]: 'APBK0919' }, 'fixture-token')).toBe('REDACTED');
});
it('redacts a token even when it resembles a code', () => {
  expect(safeKisMessageCode('EGW00123', config, 'EGW00123')).toBe('REDACTED');
});
it('does not log arbitrary operation paths, query strings or transaction IDs', () => {
  expect(kisOperationContext('/secret?CANO=12345678', 'fixture-secret')).toEqual({ operation: 'unknown', transactionId: 'UNRECOGNIZED' });
  expect(kisOperationContext('/uapi/domestic-stock/v1/trading/inquire-balance?CANO=12345678', 'fixture-secret'))
    .toEqual({ operation: 'unknown', transactionId: 'UNRECOGNIZED' });
});

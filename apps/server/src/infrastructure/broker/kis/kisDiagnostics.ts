import type { KisConfiguration } from './kisClient.ts';

export interface KisDiagnostic {
  provider: 'kis';
  operation: 'inquire_balance' | 'inquire_price' | 'order_cash' | 'inquire_psbl_order' | 'inquire_daily_ccld' | 'unknown';
  transactionId: 'VTTC8434R' | 'FHKST01010100' | 'VTTC0012U' | 'VTTC0011U' | 'VTTC8908R' | 'VTTC0081R' | 'UNRECOGNIZED';
  httpStatus: number;
  msgCode: string;
}
export type KisDiagnosticSink = (event: KisDiagnostic) => void;

/** Never log arbitrary URLs, query strings or caller-supplied transaction identifiers. */
export function kisOperationContext(path: string, transactionId: string): Pick<KisDiagnostic, 'operation' | 'transactionId'> {
  const endpoint = path.split('?')[0];
  if (endpoint === '/uapi/domestic-stock/v1/trading/order-cash' && (transactionId === 'VTTC0012U' || transactionId === 'VTTC0011U')) {
    return { operation: 'order_cash', transactionId };
  }
  if (endpoint === '/uapi/domestic-stock/v1/trading/inquire-psbl-order' && transactionId === 'VTTC8908R') {
    return { operation: 'inquire_psbl_order', transactionId };
  }
  if (endpoint === '/uapi/domestic-stock/v1/trading/inquire-daily-ccld' && transactionId === 'VTTC0081R') {
    return { operation: 'inquire_daily_ccld', transactionId };
  }
  if (endpoint === '/uapi/domestic-stock/v1/trading/inquire-balance' && transactionId === 'VTTC8434R') {
    return { operation: 'inquire_balance', transactionId: 'VTTC8434R' };
  }
  if (endpoint === '/uapi/domestic-stock/v1/quotations/inquire-price' && transactionId === 'FHKST01010100') {
    return { operation: 'inquire_price', transactionId: 'FHKST01010100' };
  }
  return { operation: 'unknown', transactionId: 'UNRECOGNIZED' };
}

/** Only bounded code-shaped identifiers may enter logs; never forward the provider envelope. */
export function safeKisMessageCode(value: string | undefined, config: KisConfiguration, token: string): string {
  if (!value || value.length !== 8 || !/^(?:[A-Z]{3}[0-9]{5}|[A-Z]{4}[0-9]{4})$/.test(value)) return 'UNRECOGNIZED';
  const secrets = [config.appKey, config.appSecret, config.accountNo, token];
  if (secrets.some((secret) => secret && value.includes(secret))) return 'REDACTED';
  return value;
}

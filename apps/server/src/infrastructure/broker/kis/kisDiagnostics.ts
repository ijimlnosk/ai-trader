import type { KisConfiguration } from './kisClient.ts';

export interface KisDiagnostic {
  provider: 'kis';
  operation: 'inquire_balance';
  msgCode: string;
}
export type KisDiagnosticSink = (event: KisDiagnostic) => void;

/** Only bounded code-shaped identifiers may enter logs; never forward the provider envelope. */
export function safeKisMessageCode(value: string | undefined, config: KisConfiguration, token: string): string {
  if (!value || value.length !== 8 || !/^(?:[A-Z]{3}[0-9]{5}|[A-Z]{4}[0-9]{4})$/.test(value)) return 'UNRECOGNIZED';
  const secrets = [config.appKey, config.appSecret, config.accountNo, token];
  if (secrets.some((secret) => secret && value.includes(secret))) return 'REDACTED';
  return value;
}

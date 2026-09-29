/** Safe console identity only; no broker credentials, ownership keys, password hashes or tokens. */
export interface ConsoleUser {
  id: string;
  email: string;
  hasTradingAccount: boolean;
}
export interface ConsoleSessionResponse { user: ConsoleUser; expiresAt: string }

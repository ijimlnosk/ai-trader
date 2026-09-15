export type HealthResponse = {
  tradingMode: 'paper' | 'live';
} & (
  | { status: 'ok'; database: 'connected' }
  | { status: 'error'; database: 'disconnected' }
);

import { BrokerError } from '../../../application/brokerError.ts';

export class KisRequestQueueFull extends BrokerError {
  constructor() { super('provider_unavailable'); }
}

/** One composed paper client: bounded FIFO, monotonic spacing, never a retry. */
export function createKisRequestGate(minIntervalMs = 0) {
  let tail = Promise.resolve();
  let nextStart = 0;
  let outstanding = 0;
  return <T>(send: () => Promise<T>): Promise<T> => {
    if (outstanding >= 8) return Promise.reject(new KisRequestQueueFull());
    outstanding++;
    const result = tail.then(async () => {
      let remaining = nextStart - performance.now();
      while (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, Math.ceil(remaining)));
        remaining = nextStart - performance.now();
      }
      nextStart = performance.now() + minIntervalMs;
      return send();
    }).finally(() => { outstanding--; });
    tail = result.then(() => {}, () => {});
    return result;
  };
}

import type { Broker } from '../../../application/broker.ts';

// No order operations until risk/execution boundaries exist.
export class PaperBroker implements Broker {
  getMode(): 'paper' {
    return 'paper';
  }
}

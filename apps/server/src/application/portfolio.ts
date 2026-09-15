import type { Portfolio } from '../domain/portfolio.ts';

export interface AccountBroker {
  getPortfolio(): Promise<Portfolio>;
}

export function createPortfolioQuery(broker: AccountBroker) {
  return (): Promise<Portfolio> => broker.getPortfolio();
}

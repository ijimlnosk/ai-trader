import { setTimeout as delay } from 'node:timers/promises';
import type { Position } from '../../../domain/portfolio.ts';
import type { AccountBroker } from '../../../application/portfolio.ts';
import { BrokerError } from '../../../application/brokerError.ts';
import type { KisConfiguration } from './kisClient.ts';
import type { KisSession } from './kisSession.ts';
import { parseKis } from './kisSchemas.ts';
import { accountSchema, portfolioPageSchema, type KisPortfolioSummary } from './kisPortfolioSchemas.ts';
import { mapPortfolio, mapPosition } from './kisPortfolioMapping.ts';

export function createKisPortfolioAdapter(config: KisConfiguration, session: KisSession): AccountBroker {
  return {
    async getPortfolio() {
      const account = accountSchema.safeParse(config);
      if (!account.success) throw new BrokerError('configuration_error');
      const positions: Position[] = [];
      const symbols = new Set<string>();
      const cursors = new Set<string>();
      let summary: KisPortfolioSummary | undefined;
      let fk = '';
      let nk = '';
      for (let page = 0; page < 20; page++) {
        // Space continuation requests for the paper API; quota failures are not retried.
        if (page > 0) await delay(1000);
        const query = new URLSearchParams({
          CANO: account.data.accountNo, ACNT_PRDT_CD: account.data.accountProductCode,
          AFHR_FLPR_YN: 'N', OFL_YN: '', INQR_DVSN: '02', UNPR_DVSN: '01',
          FUND_STTL_ICLD_YN: 'N', FNCG_AMT_AUTO_RDPT_YN: 'N', PRCS_DVSN: '00',
          CTX_AREA_FK100: fk, CTX_AREA_NK100: nk,
        });
        const response = await session.get(`/uapi/domestic-stock/v1/trading/inquire-balance?${query}`, 'VTTC8434R', page === 0 ? '' : 'N');
        const data = parseKis(portfolioPageSchema, response.body);
        const currentSummary = data.output2?.[0];
        if (!currentSummary) throw new BrokerError('account_unavailable');
        // Totals are account-wide, never a sum of page summaries.
        if (summary && JSON.stringify(summary) !== JSON.stringify(currentSummary)) throw new BrokerError('provider_invalid_response');
        summary = currentSummary;
        for (const row of data.output1) {
          const position = mapPosition(row);
          if (symbols.has(position.symbol)) throw new BrokerError('provider_invalid_response');
          symbols.add(position.symbol);
          // KIS can retain fully disposed positions temporarily.
          if (BigInt(position.quantity) !== 0n) positions.push(position);
        }
        const continuation = response.continuation?.trim();
        if (continuation === '' || continuation === 'D' || continuation === 'E') return mapPortfolio(summary, positions);
        if (continuation !== 'F' && continuation !== 'M') throw new BrokerError('provider_invalid_response');
        fk = data.ctx_area_fk100 ?? '';
        nk = data.ctx_area_nk100 ?? '';
        const cursor = JSON.stringify([fk, nk]);
        if (data.ctx_area_fk100 === undefined || data.ctx_area_nk100 === undefined ||
            (!fk.trim() && !nk.trim()) || cursors.has(cursor)) throw new BrokerError('provider_invalid_response');
        cursors.add(cursor);
      }
      // Never report a partial portfolio as complete.
      throw new BrokerError('provider_invalid_response');
    },
  };
}

'use client';
import { useQuery } from '@tanstack/react-query';
import type { PortfolioResponse } from '@ai-trader/contracts';
import { fetchConsole } from '@/shared/api/fetchConsole';
import { formatDecimal, formatKrw } from '@/shared/lib/format';
import { Empty, Panel } from '@/shared/ui/Panel';

export function PortfolioPanel() {
  const query = useQuery({ queryKey: ['console', 'portfolio'], queryFn: () => fetchConsole<PortfolioResponse>('portfolio'), refetchInterval: 60000 });
  const p = query.data;
  return (
    <Panel title="포트폴리오 (KIS paper)" updatedAt={query.dataUpdatedAt} isLoading={query.isLoading} error={query.error}>
      {p && <>
        <dl className="stats">
          <div><dt>예수금</dt><dd>{formatKrw(p.cash)}</dd></div>
          <div><dt>총평가</dt><dd>{formatKrw(p.totalEvaluation)}</dd></div>
          <div><dt>매입금액</dt><dd>{formatKrw(p.totalPurchaseAmount)}</dd></div>
          <div><dt>평가손익</dt><dd>{formatKrw(p.totalProfitLoss)} ({formatDecimal(p.totalProfitLossRate)}%)</dd></div>
        </dl>
        {p.positions.length === 0 ? <Empty>보유 종목 없음</Empty> : (
          <table><thead><tr><th>종목</th><th>수량(주)</th><th>가능</th><th>평균가</th><th>현재가</th><th>평가손익</th></tr></thead>
            <tbody>{p.positions.map((pos) => (
              <tr key={pos.symbol}><td>{pos.symbol} {pos.name}</td><td>{formatDecimal(pos.quantity)}</td><td>{formatDecimal(pos.availableQuantity)}</td>
                <td>{formatKrw(pos.averagePrice)}</td><td>{formatKrw(pos.currentPrice)}</td><td>{formatKrw(pos.profitLoss)} ({formatDecimal(pos.profitLossRate)}%)</td></tr>))}
            </tbody></table>)}
        <p className="muted">예수금은 주문가능금액이 아닙니다. 평가손익은 미실현이며 원장 실현손익과 다릅니다.</p>
      </>}
    </Panel>
  );
}

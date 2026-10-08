'use client';
import { useState } from 'react';
import { LatestRunCard } from '@/entities/loopRuns/LatestRunCard';
import { LoopRunsList } from '@/entities/loopRuns/LoopRunsList';
import { OrdersList } from '@/entities/orders/OrdersList';
import { HoldingsList } from '@/entities/portfolio/HoldingsList';
import { PortfolioSummary } from '@/entities/portfolio/PortfolioSummary';
import { SnapshotsList } from '@/entities/snapshots/SnapshotsList';
import { NewsList } from '@/entities/news/NewsList';
import { PlanCard } from '@/entities/plan/PlanCard';
import { StatusCard } from '@/entities/status/StatusCard';
import { AutoTradingCard } from '@/features/autoTrading/AutoTradingCard';
import { Tabs } from '@/shared/ui/Tabs';
import { AppBar } from './AppBar';
import { InsightsPanel } from './InsightsPanel';
import { SettingsPanel } from '@/features/settings/SettingsPanel';

const TABS = [
  { value: 'holdings', label: '보유' }, { value: 'insights', label: '판단 근거' }, { value: 'orders', label: '주문' },
  { value: 'runs', label: '실행기록' }, { value: 'news', label: '뉴스' }, { value: 'data', label: '데이터' }, { value: 'settings', label: '설정' },
] as const;
type Tab = (typeof TABS)[number]['value'];

/** Read-only console. There is intentionally no order, tick or configuration control. */
export function ConsoleView({ email }: { email: string }) {
  const [tab, setTab] = useState<Tab>('holdings');
  return (
    <>
      <AppBar email={email} />
      <main className="layout">
        <div className="column">
          <PortfolioSummary />
          <AutoTradingCard />
          <StatusCard />
          <LatestRunCard />
          <PlanCard />
        </div>
        <div className="column">
          <Tabs value={tab} onChange={setTab} items={TABS}>
            {(value) => value === 'holdings' ? <HoldingsList /> : value === 'insights' ? <InsightsPanel /> : value === 'orders' ? <OrdersList />
              : value === 'runs' ? <LoopRunsList /> : value === 'news' ? <NewsList /> : value === 'settings' ? <SettingsPanel /> : <SnapshotsList />}
          </Tabs>
        </div>
      </main>
      <footer className="page-footer">읽기 전용 · 시간 KST · 금액 원 · 수량 주</footer>
    </>
  );
}

export function NoAccountView({ email }: { email: string }) {
  return (
    <>
      <AppBar email={email} showMode={false} />
      <main className="layout layout-narrow">
        <section className="card empty-state">
          <span aria-hidden className="empty-icon">🔗</span>
          <h1>연결된 거래계좌가 없어요</h1>
          <p className="subtle">이 계정에는 아직 조회할 수 있는 계좌가 없어요. 관리자에게 계좌 연결을 요청해 주세요.</p>
        </section>
      </main>
    </>
  );
}

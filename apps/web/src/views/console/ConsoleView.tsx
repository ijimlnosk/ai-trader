import { SafetyBanner } from '@/entities/status/SafetyBanner';
import { PortfolioPanel } from '@/entities/portfolio/PortfolioPanel';
import { LoopRunsPanel } from '@/entities/loopRuns/LoopRunsPanel';
import { OrdersPanel } from '@/entities/orders/OrdersPanel';
import { SnapshotsPanel } from '@/entities/snapshots/SnapshotsPanel';

/** Read-only operator console. There is intentionally no order, tick or configuration control. */
export function ConsoleView() {
  return (
    <>
      <SafetyBanner />
      <main className="grid">
        <PortfolioPanel />
        <LoopRunsPanel />
        <OrdersPanel />
        <SnapshotsPanel />
      </main>
      <footer className="muted">읽기 전용 콘솔 · 시간은 Asia/Seoul · 금액 KRW · 수량 주</footer>
    </>
  );
}

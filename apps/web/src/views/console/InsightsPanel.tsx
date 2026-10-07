'use client';
import { CollectionCard } from '@/entities/insights/CollectionCard';
import { DisclosuresCard } from '@/entities/insights/DisclosuresCard';
import { MomentumRankingCard } from '@/entities/insights/MomentumRankingCard';
import { ShadowTradingCards } from '@/entities/insights/ShadowTradingCard';
import { TakeProfitCard } from '@/entities/insights/TakeProfitCard';

/** Decision evidence and collected data in one read-only tab. */
export function InsightsPanel() {
  return (
    <div className="column">
      <ShadowTradingCards />
      <MomentumRankingCard />
      <TakeProfitCard />
      <DisclosuresCard />
      <CollectionCard />
    </div>
  );
}

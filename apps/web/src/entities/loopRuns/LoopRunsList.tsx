'use client';
import { Card, Empty } from '@/shared/ui/Card';
import { LoopRunRow } from './LoopRunRow';
import { useLoopRuns } from './queries';

export function LoopRunsList() {
  const query = useLoopRuns();
  const items = query.data?.items ?? [];
  return (
    <Card title="자동매매 실행 기록" updatedAt={query.dataUpdatedAt} isLoading={query.isLoading} error={query.error}>
      {items.length === 0 ? <Empty icon="🤖">아직 실행 기록이 없어요</Empty>
        : <ul className="rows">{items.map((run) => <LoopRunRow key={run.id} run={run} />)}</ul>}
    </Card>
  );
}

import { useQuery } from '@tanstack/react-query';
import type { ConsoleList, ConsoleLoopRun } from '@ai-trader/contracts';
import { fetchConsole } from '@/shared/api/fetchConsole';

export const useLoopRuns = () =>
  useQuery({ queryKey: ['console', 'loop-runs'], queryFn: () => fetchConsole<ConsoleList<ConsoleLoopRun>>('loop-runs', 30), refetchInterval: 60000 });

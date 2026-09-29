import { useQuery } from '@tanstack/react-query';
import type { ConsoleList, ConsoleSnapshot } from '@ai-trader/contracts';
import { fetchConsole } from '@/shared/api/fetchConsole';

export const useSnapshots = () =>
  useQuery({ queryKey: ['console', 'snapshots'], queryFn: () => fetchConsole<ConsoleList<ConsoleSnapshot>>('snapshots', 10), refetchInterval: 300000 });

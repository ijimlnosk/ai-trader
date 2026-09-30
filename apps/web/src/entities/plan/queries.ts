import { useQuery } from '@tanstack/react-query';
import type { ConsolePlanResponse } from '@ai-trader/contracts';
import { fetchConsole } from '@/shared/api/fetchConsole';

export const usePlan = () =>
  useQuery({ queryKey: ['console', 'plan'], queryFn: () => fetchConsole<ConsolePlanResponse>('plan'), refetchInterval: 300000 });

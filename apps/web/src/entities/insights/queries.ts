import { useQuery } from '@tanstack/react-query';
import type { ConsoleInsightsResponse } from '@ai-trader/contracts';
import { fetchConsole } from '@/shared/api/fetchConsole';

export const useInsights = () =>
  useQuery({ queryKey: ['console', 'insights'], queryFn: () => fetchConsole<ConsoleInsightsResponse>('insights'), refetchInterval: 300000 });

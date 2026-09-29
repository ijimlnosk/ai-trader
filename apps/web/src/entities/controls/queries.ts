import { useQuery } from '@tanstack/react-query';
import type { ConsoleControlsResponse } from '@ai-trader/contracts';
import { fetchConsole } from '@/shared/api/fetchConsole';

export const CONTROLS_KEY = ['console', 'controls'] as const;
export const useControls = () =>
  useQuery({ queryKey: CONTROLS_KEY, queryFn: () => fetchConsole<ConsoleControlsResponse>('controls'), refetchInterval: 60000 });

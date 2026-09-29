import { useQuery } from '@tanstack/react-query';
import type { BrokerStatusResponse, ConsoleStatusResponse, HealthResponse } from '@ai-trader/contracts';
import { fetchConsole } from '@/shared/api/fetchConsole';

export const useConsoleStatus = () =>
  useQuery({ queryKey: ['console', 'status'], queryFn: () => fetchConsole<ConsoleStatusResponse>('status'), refetchInterval: 30000 });
export const useHealth = () =>
  useQuery({ queryKey: ['console', 'health'], queryFn: () => fetchConsole<HealthResponse>('health'), refetchInterval: 30000, retry: false });
export const useBrokerStatus = () =>
  useQuery({ queryKey: ['console', 'broker-status'], queryFn: () => fetchConsole<BrokerStatusResponse>('broker-status'), refetchInterval: 120000 });

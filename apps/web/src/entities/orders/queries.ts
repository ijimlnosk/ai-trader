import { useQuery } from '@tanstack/react-query';
import type { ConsoleList, OrderResponse } from '@ai-trader/contracts';
import { fetchConsole } from '@/shared/api/fetchConsole';

export const useOrders = () =>
  useQuery({ queryKey: ['console', 'orders'], queryFn: () => fetchConsole<ConsoleList<OrderResponse>>('orders', 30), refetchInterval: 60000 });

import { useQuery } from '@tanstack/react-query';
import type { PortfolioResponse } from '@ai-trader/contracts';
import { fetchConsole } from '@/shared/api/fetchConsole';

export const usePortfolio = () =>
  useQuery({ queryKey: ['console', 'portfolio'], queryFn: () => fetchConsole<PortfolioResponse>('portfolio'), refetchInterval: 60000 });

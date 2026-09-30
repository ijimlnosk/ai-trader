import { useQuery } from '@tanstack/react-query';
import type { ConsoleNewsResponse } from '@ai-trader/contracts';
import { fetchConsole } from '@/shared/api/fetchConsole';

export const useNews = () =>
  useQuery({ queryKey: ['console', 'news'], queryFn: () => fetchConsole<ConsoleNewsResponse>('news', 50), refetchInterval: 300000 });

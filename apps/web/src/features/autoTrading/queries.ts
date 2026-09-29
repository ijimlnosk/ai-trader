import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ConsoleControlsResponse } from '@ai-trader/contracts';
import { ConsoleRequestError } from '@/shared/api/fetchConsole';
import { CONTROLS_KEY } from '@/entities/controls/queries';

async function postControl(body: { enabled: boolean; password?: string }): Promise<ConsoleControlsResponse> {
  const response = await fetch('/api/controls/auto-trading', { method: 'POST', cache: 'no-store',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data: unknown = await response.json().catch(() => null);
  if (response.status === 401) window.location.replace('/login');
  if (!response.ok) {
    const code = (data as { error?: { code?: unknown } } | null)?.error?.code;
    throw new ConsoleRequestError(response.status, typeof code === 'string' ? code : 'request_failed');
  }
  return data as ConsoleControlsResponse;
}

export function useSetAutoTrading() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: postControl,
    onSuccess: (data) => { client.setQueryData(CONTROLS_KEY, data); void client.invalidateQueries({ queryKey: ['console', 'status'] }); },
  });
}

export const CONTROL_ERRORS: Record<string, string> = {
  password_incorrect: '비밀번호가 맞지 않아요.',
  login_rate_limited: '시도가 너무 많아요. 15분 후 다시 시도해 주세요.',
  control_not_allowed: '서버 설정에서 자동매매가 허용되지 않아 켤 수 없어요.',
  invalid_request: '비밀번호를 입력해 주세요.',
};

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ConsoleSettingsResponse, OwnerSettingsDto } from '@ai-trader/contracts';
import { ConsoleRequestError, fetchConsole } from '@/shared/api/fetchConsole';

const KEY = ['console', 'settings'] as const;
export const useSettings = () => useQuery({ queryKey: KEY, queryFn: () => fetchConsole<ConsoleSettingsResponse>('settings') });

export class SettingsRequestError extends ConsoleRequestError {
  constructor(status: number, code: string, public readonly fields: string[]) { super(status, code); }
}

async function postSettings(body: { password: string; settings: OwnerSettingsDto }): Promise<ConsoleSettingsResponse> {
  const response = await fetch('/api/settings', { method: 'POST', cache: 'no-store', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => null) as { error?: { code?: unknown; fields?: unknown } } | null;
  if (response.status === 401) window.location.replace('/login');
  if (!response.ok) {
    const fields = Array.isArray(data?.error?.fields) ? data.error.fields.filter((f): f is string => typeof f === 'string') : [];
    throw new SettingsRequestError(response.status, typeof data?.error?.code === 'string' ? data.error.code : 'request_failed', fields);
  }
  return data as ConsoleSettingsResponse;
}

export function useSaveSettings() {
  const client = useQueryClient();
  return useMutation({ mutationFn: postSettings, onSuccess: (data) => client.setQueryData(KEY, data) });
}

export const SETTINGS_ERRORS: Record<string, string> = {
  password_incorrect: '비밀번호가 맞지 않아요.',
  login_rate_limited: '시도가 너무 많아요. 15분 후 다시 시도해 주세요.',
  invalid_settings: '허용 범위를 벗어난 값이 있어요. 위험 한도는 기본값보다 엄격하게만 바꿀 수 있어요.',
  calendar_unknown: '다음 거래일을 확인할 수 없어 저장하지 못했어요.',
  invalid_request: '비밀번호를 입력해 주세요.',
};

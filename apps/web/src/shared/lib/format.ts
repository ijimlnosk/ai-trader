/** Groups an exact decimal string without converting to floating point. */
export function formatDecimal(value: string | null | undefined): string {
  if (value === null || value === undefined || !/^[+-]?\d+(\.\d+)?$/.test(value)) return '—';
  const [integer = '', fraction] = value.replace(/^[+-]/, '').split('.');
  const sign = value.startsWith('-') ? '-' : '';
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const trimmed = fraction?.replace(/0+$/, '');
  return `${sign}${grouped}${trimmed ? `.${trimmed}` : ''}`;
}

export const formatKrw = (value: string | null | undefined) => (formatDecimal(value) === '—' ? '—' : `₩${formatDecimal(value)}`);

const seoul = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

/** Explicit Asia/Seoul rendering of a UTC instant. */
export function formatSeoulTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const time = Date.parse(iso);
  return Number.isFinite(time) ? `${seoul.format(time)} KST` : '—';
}

/** YYYYMMDD → YYYY-MM-DD for Seoul session dates. */
export const formatSessionDate = (date: string | null | undefined) =>
  date && /^\d{8}$/.test(date) ? `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}` : '—';

export type Tone = 'up' | 'down' | 'flat';
/** Korean market convention: gains red, losses blue. Exact string sign, no float parsing. */
export function toneOf(value: string | null | undefined): Tone {
  if (!value || !/^[+-]?\d+(\.\d+)?$/.test(value) || /^[+-]?0+(\.0+)?$/.test(value)) return 'flat';
  return value.startsWith('-') ? 'down' : 'up';
}

/** Signed KRW for profit/loss, e.g. +₩9,125 / -₩605. */
export function formatSignedKrw(value: string | null | undefined): string {
  const formatted = formatKrw(value?.replace(/^[+-]/, ''));
  if (formatted === '—') return '—';
  const tone = toneOf(value);
  return tone === 'up' ? `+${formatted}` : tone === 'down' ? `-${formatted}` : formatted;
}

/** "방금", "3분 전", "2시간 전", else the Seoul timestamp. */
export function formatRelative(iso: string | number | null | undefined, now = Date.now()): string {
  if (iso === null || iso === undefined || iso === '' || iso === 0) return '—';
  const time = typeof iso === 'number' ? iso : Date.parse(iso);
  if (!Number.isFinite(time)) return '—';
  const minutes = Math.floor((now - time) / 60000);
  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분 전`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)}시간 전`;
  return formatSeoulTime(new Date(time).toISOString());
}

/** YYYYMMDD → M/D for compact lists. */
export const formatShortDate = (date: string | null | undefined) =>
  date && /^\d{8}$/.test(date) ? `${Number(date.slice(4, 6))}/${Number(date.slice(6))}` : '—';

const SYMBOL_NAMES: Record<string, string> = { '005930': '삼성전자' };
/** Display name for the supported universe; unknown codes are shown as-is. */
export const symbolName = (symbol: string) => SYMBOL_NAMES[symbol] ?? symbol;

/** "1주", or "1/2주" while partially filled. Exact strings only. */
export function formatFill(filled: string, ordered: string): string {
  const [f, o] = [formatDecimal(filled), formatDecimal(ordered)];
  return f === o ? `${f}주` : `${f}/${o}주`;
}

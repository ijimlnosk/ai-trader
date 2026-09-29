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

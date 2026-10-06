/** One filing as listed by the provider; dates are Asia/Seoul YYYYMMDD, codes are provider strings. */
export interface Disclosure {
  receiptNo: string;
  corpCode: string;
  corpName: string;
  /** Six-character KRX code (newer listings mix in letters, e.g. 0099X0), or '' for unlisted filers. */
  stockCode: string;
  corpClass: string;
  reportName: string;
  filerName: string;
  receiptDate: string;
  remarks: string;
}

export interface DisclosurePage { items: Disclosure[]; totalPages: number }

export interface DisclosureSource {
  readonly provider: string;
  /** All filings received in [from, through], 100 per page, page numbers from 1; no data is an empty page. */
  listPage(from: string, through: string, page: number): Promise<DisclosurePage>;
}

export interface DisclosureRepository {
  /** Insert-only by receipt number; returns how many rows were new. */
  save(items: readonly (Disclosure & { provider: string; collectedAt: string })[]): Promise<number>;
}

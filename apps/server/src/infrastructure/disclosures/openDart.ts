import { z } from 'zod';
import type { Disclosure, DisclosureSource } from '../../application/disclosures/ports.ts';

const itemSchema = z.object({ corp_code: z.string().regex(/^\d{8}$/), corp_name: z.string().max(200),
  stock_code: z.string().trim().regex(/^([0-9A-Z]{6})?$/), corp_cls: z.string().max(2), report_nm: z.string().max(500),
  rcept_no: z.string().regex(/^\d{14}$/), flr_nm: z.string().max(200), rcept_dt: z.string().regex(/^\d{8}$/), rm: z.string().max(50) });
const responseSchema = z.object({ status: z.string(), total_page: z.number().int().min(0).max(1000).optional(),
  list: z.array(itemSchema).max(100).optional() });

/**
 * OpenDART disclosure search (list.json) over all filers, 100 per page. Status 013 means no filings.
 * Errors carry only the provider status or HTTP code: the request URL holds the key and is never reported.
 */
export function createOpenDartSource(config: { apiKey: string }, fetcher: typeof fetch = fetch, timeoutMs = 10000): DisclosureSource {
  return {
    provider: 'opendart',
    async listPage(from, through, page) {
      if (!/^\d{8}$/.test(from) || !/^\d{8}$/.test(through) || from > through || !Number.isInteger(page) || page < 1) throw new Error('dart_invalid_request');
      const query = new URLSearchParams({ crtfc_key: config.apiKey, bgn_de: from, end_de: through, page_no: String(page), page_count: '100' });
      const response = await fetcher(`https://opendart.fss.or.kr/api/list.json?${query}`, { redirect: 'error', signal: AbortSignal.timeout(timeoutMs) });
      if (!response.ok) throw new Error(`dart_http_${response.status}`);
      const parsed = responseSchema.safeParse(await response.json());
      if (!parsed.success) throw new Error('dart_invalid_response');
      const body = parsed.data;
      if (body.status === '013') return { items: [], totalPages: 0 };
      if (body.status !== '000' || body.total_page === undefined || !body.list) throw new Error(`dart_status_${body.status.slice(0, 3)}`);
      const items = body.list.map((item): Disclosure => ({ receiptNo: item.rcept_no, corpCode: item.corp_code, corpName: item.corp_name,
        stockCode: item.stock_code, corpClass: item.corp_cls, reportName: item.report_nm.trim(), filerName: item.flr_nm.trim(), receiptDate: item.rcept_dt, remarks: item.rm }));
      if (items.some((item) => item.receiptDate < from || item.receiptDate > through)) throw new Error('dart_invalid_response');
      return { items, totalPages: body.total_page };
    },
  };
}

export interface QuotaCaps { daily: number; monthly: number }
export interface QuotaUsage { daily: number; monthly: number }

/** Persisted, atomic call budget. consume() reserves one call before it is made, or refuses. */
export interface ApiQuota {
  /** Reserves `amount` units (calls, or micro-USD for cost budgets); refuses if either cap would be exceeded. */
  consume(provider: string, day: string, month: string, caps: QuotaCaps, amount?: number): Promise<boolean>;
  /** Returns an over-reservation after the actual amount is known (never below zero). */
  refund(provider: string, day: string, month: string, amount: number): Promise<void>;
  usage(provider: string, day: string, month: string): Promise<QuotaUsage>;
}

export interface NewsArticle { title: string; description: string; link: string; originalLink: string | null; publishedAt: string }
export interface NewsSearch {
  readonly provider: string;
  search(query: string): Promise<NewsArticle[]>;
}

export interface StoredNews extends NewsArticle { id: string; symbol: string; provider: string; query: string; collectedAt: string }
export interface NewsRepository {
  /** Inserts new (symbol, link) pairs only; returns how many were new. */
  save(items: Omit<StoredNews, 'id'>[]): Promise<number>;
  recent(limit: number): Promise<StoredNews[]>;
  /** Newest first, published at or after `since`, at most `limit`. */
  recentForSymbol(symbol: string, since: string, limit: number): Promise<StoredNews[]>;
}

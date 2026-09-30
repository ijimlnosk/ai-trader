export interface QuotaCaps { daily: number; monthly: number }
export interface QuotaUsage { daily: number; monthly: number }

/** Persisted, atomic call budget. consume() reserves one call before it is made, or refuses. */
export interface ApiQuota {
  consume(provider: string, day: string, month: string, caps: QuotaCaps): Promise<boolean>;
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
}

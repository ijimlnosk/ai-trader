import type { ApiQuota } from '../src/application/news/ports.ts';

export function memoryQuota(): ApiQuota & { used: Map<string, number> } {
  const used = new Map<string, number>();
  return {
    used,
    async consume(provider, day, month, caps, amount = 1) {
      const [d, m] = [`${provider}:d:${day}`, `${provider}:m:${month}`];
      if ((used.get(d) ?? 0) + amount > caps.daily || (used.get(m) ?? 0) + amount > caps.monthly) return false;
      used.set(d, (used.get(d) ?? 0) + amount); used.set(m, (used.get(m) ?? 0) + amount);
      return true;
    },
    async refund(provider, day, month, amount) {
      for (const key of [`${provider}:d:${day}`, `${provider}:m:${month}`]) used.set(key, Math.max(0, (used.get(key) ?? 0) - amount));
    },
    async usage(provider, day, month) {
      return { daily: used.get(`${provider}:d:${day}`) ?? 0, monthly: used.get(`${provider}:m:${month}`) ?? 0 };
    },
  };
}

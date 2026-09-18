import { readFile } from 'node:fs/promises';
import { datasetSchema } from '../../application/strategy/input.ts';
import { validateDataset, type MarketDataset } from '../../domain/strategy/marketData.ts';
export function parseDataset(input: unknown): MarketDataset {
  const data = datasetSchema.parse(input);
  validateDataset(data);
  return data;
}
export async function readDataset(path: string): Promise<MarketDataset> {
  return parseDataset(JSON.parse(await readFile(path, 'utf8')));
}

import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { DEFAULT_BACKTEST_SETTINGS, runBacktest, validateBacktestSettings } from '../application/backtest/index.ts';
import { evaluateStrategy } from '../domain/strategy/evaluate.ts';
import { evaluateRisk } from '../domain/risk/index.ts';
import { readDataset } from '../infrastructure/market/dataset.ts';
import { sampleDataset } from '../infrastructure/market/sample.ts';
const settingsSchema = z.strictObject({ initialCash: z.string(), killSwitchEnabled: z.boolean(),
  costs: z.strictObject({ commissionBps: z.number(), sellTaxBps: z.number(), slippageBps: z.number() }),
  strategy: z.strictObject({ minPrice: z.string(), minAverageTurnover: z.string(), minRsi: z.number(), maxRsi: z.number(),
    minVolumeRatio: z.number(), riskBudgetBps: z.number(), maxAllocationBps: z.number(), atrMultiple: z.number() }) });
async function main() {
  const [mode = '--sample', path, settingsPath, ...extra] = process.argv.slice(2);
  if (!['--sample', '--file', '--evaluate'].includes(mode) || extra.length || (mode !== '--sample' && !path) || (mode === '--sample' && path !== undefined)) {
    throw new Error('Usage: backtest --sample | --file DATA.json [SETTINGS.json] | --evaluate DATA.json [SETTINGS.json]');
  }
  const data = mode === '--sample' ? sampleDataset() : await readDataset(path!);
  const settings = settingsPath ? settingsSchema.parse(JSON.parse(await readFile(settingsPath, 'utf8'))) : DEFAULT_BACKTEST_SETTINGS;
  // Evaluation mode is deliberately an explicit hypothetical flat account, never a broker snapshot.
  validateBacktestSettings(settings);
  if (mode === '--evaluate') {
    const context = { cash: settings.initialCash, totalEquity: settings.initialCash, dailyRealizedPnl: '0',
      openPositionCount: 0, consecutiveLosses: 0, killSwitchEnabled: settings.killSwitchEnabled };
    const evaluations = [...data.series].sort((a, b) => a.symbol < b.symbol ? -1 : 1).map((series) => {
      const signal = evaluateStrategy(series.symbol, series.candles, { ...context, heldQuantity: '0' }, data.source, settings.strategy);
      return { signal, context, decision: signal.proposal ? evaluateRisk(signal.proposal, context) : null };
    });
    process.stdout.write(JSON.stringify({ mode: 'hypothetical-flat-account', evaluations }, null, 2) + '\n');
  } else process.stdout.write(JSON.stringify(runBacktest(data, settings), null, 2) + '\n');
}
main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Backtest failed'}\n`);
  process.exitCode = 1;
});

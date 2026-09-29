import { createHash, randomUUID } from 'node:crypto';
import { strategySetup } from './strategySetup.ts';
import { createPaperLoop } from '../src/application/paperLoop/index.ts';
import { PaperLoopError, type PaperLoopRepository, type PaperLoopRun } from '../src/application/paperLoop/ports.ts';
import { terminalLoopOrder } from '../src/application/paperLoop/recovery.ts';
import type { PaperLoopInput } from '../src/application/paperLoop/input.ts';

export function paperLoopSetup() {
  const s = strategySetup();
  s.data.series = [s.data.series[0]!];
  const input: PaperLoopInput = { runKey: 'loop-test', sessionDate: '20260916', data: s.data,
    dataRef: 'test-only-fixture', dataSha256: createHash('sha256').update(JSON.stringify(s.data)).digest('hex'),
    calendar: { source: 'explicit test fixture', sessions: [...s.data.sessions, '20260916'] } };
  const runs = new Map<string, PaperLoopRun>();
  const repo: PaperLoopRepository = {
    async find(key, orderKey) { return structuredClone([...runs.values()].find(r => r.input.runKey === key || r.orderKey === orderKey) ?? null); },
    async claim(input, orderKey, deadline) {
      const existing = [...runs.values()].find(r => r.input.runKey === input.runKey || r.orderKey === orderKey);
      if (existing) return { run: structuredClone(existing), created: false };
      if ([...runs.values()].some(r => r.status !== 'COMPLETE')) throw new PaperLoopError('loop_busy');
      const run: PaperLoopRun = { id: randomUUID(), input, orderKey, deadline, status: 'CLAIMED', result: null,
        order: null, reason: null, createdAt: s.deps.now!().toISOString(), updatedAt: s.deps.now!().toISOString(), version: 0 };
      runs.set(run.id, structuredClone(run)); return { run, created: true };
    },
    async update(run, patch) {
      if (runs.get(run.id)?.version !== run.version) throw new PaperLoopError('loop_conflict');
      const next = { ...run, ...patch, version: run.version + 1 };
      runs.set(run.id, structuredClone(next)); return next;
    },
    async findOrder(key) { return structuredClone([...s.rows.values()].find(o => o.idempotencyKey === key) ?? null); },
    async hasUnresolvedOrder() { return [...s.rows.values()].some(o => !terminalLoopOrder(o)); },
  };
  const deps = { repository: repo, strategy: s.evaluate, orders: s.strategyDeps.orders,
    enabled: true, executionEnabled: true, now: s.strategyDeps.now };
  return { ...s, input, runs, repo, loopDeps: deps, tick: createPaperLoop(deps) };
}

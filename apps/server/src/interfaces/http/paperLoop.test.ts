import Fastify from 'fastify';
import { expect, it } from 'vitest';
import { paperLoopSetup } from '../../../test/paperLoopSetup.ts';
import { registerPaperLoopRoute } from './paperLoop.ts';
import { createPaperLoop } from '../../application/paperLoop/index.ts';

it('requires authentication, rejects unsafe payloads, and keeps execution disabled by default', async () => {
  const s = paperLoopSetup(); const app = Fastify();
  registerPaperLoopRoute(app, createPaperLoop({ ...s.loopDeps, enabled: false }), 'test-token');
  const request = { method: 'POST' as const, url: '/api/v1/strategy/paper-loop/tick', payload: s.input };
  try {
    expect((await app.inject(request)).statusCode).toBe(401);
    const headers = { authorization: 'Bearer test-token' };
    expect((await app.inject({ ...request, headers, payload: { ...s.input, executeSymbol: '005930' } })).statusCode).toBe(400);
    const disabled = await app.inject({ ...request, headers });
    expect(disabled.statusCode).toBe(503); expect(disabled.json().error.code).toBe('loop_disabled');
    expect(disabled.headers['cache-control']).toBe('no-store');
    expect(s.broker.submitOrder).not.toHaveBeenCalled();
  } finally { await app.close(); }
});
it('maps successful tick and conflicting reuse without exposing internal errors', async () => {
  const s = paperLoopSetup(); const app = Fastify(); registerPaperLoopRoute(app, s.tick, 'test-token');
  const request = { method: 'POST' as const, url: '/api/v1/strategy/paper-loop/tick', headers: { authorization: 'Bearer test-token' }, payload: s.input };
  try {
    expect((await app.inject(request)).statusCode).toBe(200);
    expect((await app.inject({ ...request, payload: { ...s.input, dataRef: 'changed' } })).statusCode).toBe(409);
    s.repo.find = async () => { throw new Error('private-secret'); };
    const failed = await app.inject(request);
    expect(failed.statusCode).toBe(503); expect(failed.body).not.toContain('private-secret');
  } finally { await app.close(); }
});

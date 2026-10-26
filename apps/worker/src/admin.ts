import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import { timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { Id } from '@ieum/contracts';
import { Pipeline, PolicySchema } from './pipeline.ts';
export async function createAdmin(pipeline: Pipeline, token: string) {
  if (token.length < 32) throw new Error('ADMIN_TOKEN must be at least 32 characters');
  const app = Fastify({ logger: false, bodyLimit: 2_000_000, trustProxy: false });
  await app.register(helmet);
  app.addHook('onRequest', async (req, reply) => {
    if (req.method === 'GET' && ['/ops', '/ops/admin.js'].includes(req.url)) return;
    const value = Buffer.from(req.headers.authorization?.replace(/^Bearer /, '') || ''); const expected = Buffer.from(token);
    if (value.length !== expected.length || !timingSafeEqual(value, expected)) return reply.status(401).send({ error: 'Operator token required' });
  });
  app.setErrorHandler((error, _req, reply) => reply.status(error instanceof z.ZodError ? 400 : 409).send({ error: '작업 실패. 형식·검수 상태·배치 버전을 확인해주세요.' }));
  app.get('/ops', async (_req, reply) => reply.type('text/html; charset=utf-8').send(await readFile(new URL('../public/index.html', import.meta.url), 'utf8')));
  app.get('/ops/admin.js', async (_req, reply) => reply.type('application/javascript').send(await readFile(new URL('../public/admin.js', import.meta.url), 'utf8')));
  app.get('/ops/status', async () => {
    const [runs, staging, batches, active, queue] = await Promise.all([
      pipeline.pool.query('SELECT id,source,status,started_at,checkpoint FROM ingestion_runs ORDER BY started_at DESC LIMIT 50'),
      pipeline.pool.query('SELECT id,run_id,status,reviewed_by,reviewed_at,reason,draft FROM staging_records ORDER BY id LIMIT 100'),
      pipeline.pool.query('SELECT version,created_at,reviewer FROM approved_batches ORDER BY created_at DESC LIMIT 30'),
      pipeline.pool.query('SELECT version FROM active_batch'),
      pipeline.pool.query("SELECT resource_id,version,reason,due_at FROM revalidation_queue WHERE due_at<=now() AND status='pending' LIMIT 100")
    ]);
    return { runs: runs.rows, staging: staging.rows, batches: batches.rows, active: active.rows[0]?.version ?? null, revalidation: queue.rows };
  });
  app.post('/ops/runs', async req => { const body = z.strictObject({ source: z.string().min(1), policy: PolicySchema }).parse(req.body); return { runId: await pipeline.start(body.source, body.policy) }; });
  app.post('/ops/import', async req => {
    const b = z.strictObject({ runId: Id, externalId: Id, sourceUrl: z.url(), payload: z.unknown(), draft: z.unknown() }).parse(req.body);
    const rawId = await pipeline.record(b.runId, b.externalId, b.sourceUrl, b.payload);
    return { rawId, stagingId: await pipeline.stage(b.runId, rawId, b.draft) };
  });
  app.post('/ops/review', async req => { const b = z.strictObject({ id: Id, status: z.enum(['approved', 'needs_revision', 'rejected', 'expired']), actor: z.string().min(1), reason: z.string().min(1) }).parse(req.body); await pipeline.review(b.id, b.status, b.actor, b.reason); return { ok: true }; });
  app.post('/ops/publish', async req => { const b = z.strictObject({ id: Id, version: Id, actor: z.string().min(1), reason: z.string().min(1), publicDataReviewed: z.literal(true) }).parse(req.body); const snapshot = await pipeline.publish(b.id, b.version, b.actor, b.reason); return snapshot.manifest; });
  app.post('/ops/rollback', async req => { const b = z.strictObject({ version: Id, actor: z.string().min(1), reason: z.string().min(1) }).parse(req.body); await pipeline.rollback(b.version, b.actor, b.reason); return { ok: true }; });
  return app;
}

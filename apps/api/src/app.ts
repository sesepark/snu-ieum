import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { z } from 'zod';
import { FiltersSchema, Id, InterpretRequestSchema, SearchRequestSchema, type SearchResponse } from '@ieum/contracts';
import { catalog, graph, filteredResources, recommend } from '@ieum/catalog';
import type { Repository } from './repository.ts';
import type { AI } from './ai.ts';

const Query = z.object({ q: z.string().max(300).optional(), kind: z.string().optional(), department: z.string().optional() });
const filters = (input: unknown) => {
  const query = Query.parse(input);
  return FiltersSchema.parse({ q: query.q, kinds: query.kind?.split(',').filter(Boolean), departmentIds: query.department?.split(',').filter(Boolean) });
};
export async function createApp(repository: Repository, options: { ai?: AI; origin?: string; prototype?: boolean } = {}) {
  // No request logger: goals and query strings must never enter logs or shared caches.
  const app = Fastify({ logger: false, bodyLimit: 24_000, trustProxy: false });
  await app.register(cors, { origin: options.origin ?? 'https://sesepark.github.io', methods: ['GET', 'POST'] });
  await app.register(helmet);
  await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });
  app.addHook('onSend', async (_req, reply) => { reply.header('Cache-Control', 'no-store'); });
  app.setErrorHandler((error, _req, reply) => {
    const status = error instanceof z.ZodError ? 400 : (typeof error === 'object' && error && 'statusCode' in error && typeof error.statusCode === 'number' ? error.statusCode : 503);
    reply.status(status).send({ error: status === 400 ? '요청 형식을 확인해주세요.' : status === 429 ? '잠시 후 다시 시도해주세요.' : '현재 API를 사용할 수 없습니다. 스냅샷으로 탐색해주세요.' });
  });
  const snapshot = async () => {
    const s = await repository.snapshot();
    if (s.manifest.publication !== 'approved' && !options.prototype) throw new Error('Prototype cannot be served in production');
    return s;
  };
  app.get('/health', async () => { const s = await snapshot(); return { ok: true, version: s.manifest.version }; });
  app.get('/v1/catalog', async () => { const s = await snapshot(); return { ...catalog(s), snapshot: s, aiAvailable: Boolean(options.ai) }; });
  app.get('/v1/resources', async req => {
    const pagination = z.object({ page: z.coerce.number().int().min(1).max(10000).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(30) }).parse(req.query);
    const resources = filteredResources(await snapshot(), filters(req.query));
    const offset = (pagination.page - 1) * pagination.pageSize;
    return { resources: resources.slice(offset, offset + pagination.pageSize), total: resources.length, ...pagination };
  });
  app.get('/v1/resources/:id', async (req, reply) => {
    const { id } = z.object({ id: Id }).parse(req.params);
    const s = await snapshot(); const resource = s.resources.find(r => r.id === id);
    if (!resource) return reply.status(404).send({ error: '수록 자원이 없습니다.' });
    const relations = s.relations.filter(e => e.from === id || e.to === id);
    const evidence = s.evidence.filter(e => e.resourceIds.includes(id));
    const sourceIds = new Set([...resource.sourceIds, ...relations.flatMap(e => e.sourceIds), ...evidence.flatMap(e => e.sourceIds)]);
    return { resource, relations, evidence, sources: s.sources.filter(source => sourceIds.has(source.id)), version: s.manifest.version };
  });
  app.get('/v1/graph', async req => {
    const query = z.object({ focus: Id.optional(), depth: z.coerce.number().int().min(1).max(2).default(1), evidence: z.enum(['true', 'false']).default('false'), expanded: z.enum(['true', 'false']).default('false') }).parse(req.query);
    return graph(await snapshot(), filters(req.query), { focus: query.focus, depth: query.depth, evidence: query.evidence === 'true', expanded: query.expanded === 'true' });
  });
  app.post('/v1/goals/interpret', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const input = InterpretRequestSchema.parse(req.body);
    if (options.ai) try { return { profile: await options.ai.interpret(input.goal), mode: 'ai' }; } catch { /* No provider body or goal in logs. */ }
    return reply.status(503).send({ profile: null, mode: 'fallback', message: 'AI 해석을 사용할 수 없어 일반 검색으로 전환합니다.' });
  });
  app.post('/v1/search', async req => {
    const input = SearchRequestSchema.parse(req.body); const s = await snapshot();
    let mode: SearchResponse['mode'] = 'ordinary'; let message: string | undefined;
    let semantic = new Map<string, number>();
    if (input.aiConsent && input.profile) {
      mode = 'fallback';
      if (options.ai && repository.semantic) try {
        const terms = Object.values(input.profile).flat().join(' ').slice(0, 4000);
        semantic = await repository.semantic(await options.ai.embed(terms), options.ai.embeddingModel, s.manifest.version);
        if (semantic.size) mode = 'ai';
      } catch { /* Ordinary search remains available. */ }
      if (mode === 'fallback') message = 'AI 검색을 사용할 수 없어 일반 검색 결과를 표시합니다.';
    }
    let results = recommend(s, input, semantic);
    if (!semantic.size && input.q && repository.similar) {
      const similar = await repository.similar(input.q, s.manifest.version);
      const extra = recommend(s, { ...input, q: '' }).filter(r => similar.has(r.resource.id) && !results.some(x => x.resource.id === r.resource.id));
      results = [...results, ...extra.map(r => ({ ...r, reason: '공식 소개 텍스트와 검색어의 부분·문자 유사도를 확인한 후보입니다.' }))];
    }
    return { results: results.slice(0, 12), mode, message } satisfies SearchResponse;
  });
  return app;
}

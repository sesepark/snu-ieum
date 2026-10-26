import { afterEach, describe, expect, it, vi } from 'vitest';
import seed from '../../../data/prototype.json' with { type: 'json' };
import { parseSnapshot } from '@ieum/catalog';
import { createApp } from './app.ts';
import { Gemini } from './ai.ts';
const snapshot = parseSnapshot(seed);
const repository = { snapshot: async () => snapshot };
const profile = { problemDomains: [], coreTechnologies: [], requiredCapabilities: [], expectedOutputs: [], keywords: ['AI'] };
const apps: Awaited<ReturnType<typeof createApp>>[] = [];
async function setup(options = {}) { const app = await createApp(repository, { prototype: true, ...options }); apps.push(app); return app; }
afterEach(async () => { await Promise.all(apps.splice(0).map(app => app.close())); });
describe('public API', () => {
  it('serves catalog, detail, graph and paginated resources', async () => {
    const app = await setup();
    expect((await app.inject('/v1/catalog')).json().departments).toHaveLength(12);
    const page = (await app.inject('/v1/resources?pageSize=2')).json();
    expect(page.resources).toHaveLength(2); expect(page.total).toBe(6);
    expect((await app.inject('/v1/resources/lab-bi')).json().sources.length).toBeGreaterThan(0);
    expect((await app.inject('/v1/graph?focus=lab-bi&depth=2')).json().nodes).toHaveLength(2);
    expect((await app.inject('/v1/graph?depth=5')).statusCode).toBe(400);
    expect((await app.inject('/v1/resources/missing')).statusCode).toBe(404);
  });
  it('does not register admin or project routes', async () => {
    const app = await setup();
    for (const url of ['/v1/admin/ingestion-runs', '/admin/review', '/v1/projects']) expect((await app.inject(url)).statusCode).toBe(404);
  });
  it('never calls any provider without explicit consent', async () => {
    const interpret = vi.fn(); const embed = vi.fn();
    const app = await setup({ ai: { interpret, embed, embeddingModel: 'test' } });
    expect((await app.inject({ method: 'POST', url: '/v1/goals/interpret', payload: { goal: 'private', aiConsent: false } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/v1/search', payload: { q: 'AI' } })).json().mode).toBe('ordinary');
    expect(interpret).not.toHaveBeenCalled(); expect(embed).not.toHaveBeenCalled();
  });
  it('falls back on provider timeout or malformed JSON without reflecting goals', async () => {
    const ai = { embeddingModel: 'test', interpret: vi.fn().mockRejectedValue(new Error('private secret')), embed: vi.fn().mockRejectedValue(new Error('429')) };
    const app = await setup({ ai });
    const result = await app.inject({ method: 'POST', url: '/v1/goals/interpret', payload: { goal: 'private secret', aiConsent: true } });
    expect(result.statusCode).toBe(503); expect(result.body).not.toContain('private secret'); expect(result.headers['cache-control']).toBe('no-store');
    const search = (await app.inject({ method: 'POST', url: '/v1/search', payload: { q: 'AI', aiConsent: true, profile } })).json();
    expect(search.mode).toBe('fallback'); expect(search.results.length).toBeGreaterThan(0);
  });
  it('rejects prototype data on the production boundary', async () => {
    const app = await setup({ prototype: false });
    expect((await app.inject('/v1/catalog')).statusCode).toBe(503);
  });
  it('validates goal output and quota before external transmission', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"inventedResource":"x"}' }] } }] }), { status: 200 }));
    const blocked = new Gemini('server-key', { reserve: async () => false }, 'embedding', 'text', fetcher);
    await expect(blocked.interpret('private')).rejects.toThrow('quota'); expect(fetcher).not.toHaveBeenCalled();
    const invalid = new Gemini('server-key', { reserve: async () => true }, 'embedding', 'text', fetcher);
    await expect(invalid.interpret('private')).rejects.toThrow();
  });
});

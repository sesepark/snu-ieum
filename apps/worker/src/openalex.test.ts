import { expect, it, vi } from 'vitest';
import { collectOpenAlex } from './openalex.ts';
import type { Pipeline, Policy } from './pipeline.ts';
const policy: Policy = { reviewedBy: 'test', termsCheckedAt: '2026-10-26T00:00:00Z', robotsCheckedAt: '2026-10-26T00:00:00Z', allowedHosts: ['api.openalex.org'], allowedPathPrefixes: ['/works'], storage: 'sanitized-payload', parserVersion: 'openalex-test' };
const options = { institutionId: 'I123', apiKey: 'server-secret', maxPages: 1 };
function fakePipeline() { return { run: vi.fn().mockResolvedValue({status: 'running', checkpoint: {}}), record: vi.fn().mockResolvedValue('raw'), stageCandidate: vi.fn(), finish: vi.fn(), checkpoint: vi.fn() }; }
it('preserves the whole page, excludes the key from raw URLs and checkpoints only after staging', async () => {
  const pipeline = fakePipeline();
  const payload = { meta: { next_cursor: 'next' }, results: [{ id: 'https://openalex.org/W123', title: 'Fixture paper', extra: { keep: true } }], extraPage: 'preserved' };
  const request = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload)));
  const result = await collectOpenAlex(pipeline as unknown as Pipeline, 'run', policy, options, { reserve: async () => true }, request);
  expect(result.paused).toBe(true); expect(pipeline.record.mock.calls[0][2]).not.toContain('server-secret');
  expect(pipeline.record.mock.calls[0][3]).toEqual(payload);
  expect(pipeline.stageCandidate.mock.invocationCallOrder[0]).toBeLessThan(pipeline.checkpoint.mock.invocationCallOrder[0]);
  expect(pipeline.checkpoint).toHaveBeenCalledWith('run', 'next');
});
it('does not request after budget exhaustion and leaves cursor resumable', async () => {
  const request = vi.fn(); const pipeline = fakePipeline();
  const result = await collectOpenAlex(pipeline as unknown as Pipeline, 'run', policy, { ...options, cursor: 'resume' }, { reserve: async () => false }, request);
  expect(request).not.toHaveBeenCalled(); expect(result.cursor).toBe('resume');
});
it('stops on 429 without leaking request credentials', async () => {
  const pipeline = fakePipeline();
  await expect(collectOpenAlex(pipeline as unknown as Pipeline, 'run', policy, options, { reserve: async () => true }, vi.fn().mockResolvedValue(new Response('', { status: 429 })))).rejects.toThrow('resume');
  expect(pipeline.finish).toHaveBeenCalledWith('run', 'failed'); expect(pipeline.checkpoint).not.toHaveBeenCalled();
});

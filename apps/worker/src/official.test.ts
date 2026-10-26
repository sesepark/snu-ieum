import { expect, it, vi } from 'vitest';
import { fetchAllowed, parseOfficial, readLimited, collectOfficial } from './official.ts';
import type { Policy, Pipeline } from './pipeline.ts';
const policy: Policy = { reviewedBy: 'test', termsCheckedAt: '2026-10-26T00:00:00Z', robotsCheckedAt: '2026-10-26T00:00:00Z', allowedHosts: ['cse.snu.ac.kr'], allowedPathPrefixes: ['/en/'], storage: 'metadata-only', artifactsAllowed: false, parserVersion: 'test' };
it('extracts only explicit fields and sanitizes before artifact/raw writes', () => {
  const result = parseOfficial('<h1>Official Lab</h1><main>알고리즘 연구 person@example.org 02-880-1234</main><a href="mailto:private@example.org">문의</a><script>tracking()</script>', { name: 'h1', summary: 'main' });
  expect(result.name).toBe('Official Lab'); expect(result.summary).toContain('알고리즘');
  expect(result.html).not.toContain('example.org'); expect(result.html).not.toContain('tracking');
});
it('validates every redirect before making the next request', async () => {
  const request = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/private' } }));
  await expect(fetchAllowed('https://cse.snu.ac.kr/en/research/labs/4', policy, request)).rejects.toThrow();
  expect(request).toHaveBeenCalledTimes(1);
});
it('bounds downloaded bodies', async () => { await expect(readLimited(new Response('123456'), 4)).rejects.toThrow('limit'); });

it('queues a failed official source for revalidation and marks the run failed', async () => {
  const pipeline = {sourceFailed:vi.fn(),finish:vi.fn()};
  const url = 'https://cse.snu.ac.kr/en/research/labs/4';
  await expect(collectOfficial(pipeline as unknown as Pipeline,'run',url,policy,{kind:'lab',name:'h1',summary:'main'},vi.fn().mockResolvedValue(new Response('',{status:404})))).rejects.toThrow();
  expect(pipeline.sourceFailed).toHaveBeenCalledWith(url); expect(pipeline.finish).toHaveBeenCalledWith('run','failed');
});

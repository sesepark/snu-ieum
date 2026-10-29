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

it('persists permitted Raw before a source-specific selector failure', async () => {
  const pipeline={record:vi.fn().mockResolvedValue('raw'),stageCandidate:vi.fn(),sourceFailed:vi.fn(),finish:vi.fn()};
  const response=new Response('<h1>공식 표본</h1><main>내용</main>',{headers:{'content-type':'text/html'}});
  await expect(collectOfficial(pipeline as unknown as Pipeline,'run','https://cse.snu.ac.kr/en/research/labs/4',policy,{kind:'lab',name:'.missing',summary:'main'},vi.fn().mockResolvedValue(response))).rejects.toThrow('selector');
  expect(pipeline.record).toHaveBeenCalledOnce(); expect(pipeline.stageCandidate).not.toHaveBeenCalled();
  expect(pipeline.record.mock.calls[0][3].contentSha256).toMatch(/^[a-f0-9]{64}$/);
  expect(pipeline.finish).toHaveBeenCalledWith('run','failed');
});


it('cancels oversized streams instead of continuing to download', async () => {
  const cancel = vi.fn();
  const stream = new ReadableStream({pull(controller) { controller.enqueue(new Uint8Array(20)); }, cancel});
  await expect(readLimited(new Response(stream), 10)).rejects.toThrow('limit');
  expect(cancel).toHaveBeenCalledOnce();
});

it('reports throttling without following or retrying the source immediately', async () => {
  const request=vi.fn().mockResolvedValue(new Response('busy',{status:429,headers:{'Retry-After':'120'}}));
  await expect(fetchAllowed('https://cse.snu.ac.kr/en/research/labs/4',policy,request)).rejects.toThrow('HTTP 429); retry-after=120');
  expect(request).toHaveBeenCalledOnce();
});

it('does not stage an empty description after a site layout change', async () => {
  const pipeline={record:vi.fn().mockResolvedValue('raw'),stageCandidate:vi.fn(),sourceFailed:vi.fn(),finish:vi.fn()};
  const request=vi.fn().mockResolvedValue(new Response('<h1>Official Lab</h1>',{headers:{'content-type':'text/html'}}));
  await expect(collectOfficial(pipeline as unknown as Pipeline,'run','https://cse.snu.ac.kr/en/research/labs/4',policy,{kind:'lab',name:'h1',summary:'main'},request)).rejects.toThrow('selector');
  expect(pipeline.record).toHaveBeenCalledOnce();
  expect(pipeline.stageCandidate).not.toHaveBeenCalled();
  expect(pipeline.sourceFailed).toHaveBeenCalledOnce();
});

import { z } from 'zod';
import type { Budget } from '../../api/src/ai.ts';
import { Pipeline, assertAllowed, type Policy } from './pipeline.ts';
import { readLimited } from './official.ts';
import { sanitize } from './privacy.ts';
const Options = z.object({ institutionId: z.string().regex(/^I\d+$/), apiKey: z.string().min(1), maxPages: z.number().int().min(1).max(1000), cursor: z.string().max(4096).optional() });
const Page = z.object({ meta: z.object({ next_cursor: z.string().nullable() }), results: z.array(z.object({ id: z.string().regex(/^https:\/\/openalex.org\/W\d+$/), title: z.string().nullable(), doi: z.string().nullable().optional(), publication_year: z.number().optional() }).passthrough()) }).passthrough();
export async function collectOpenAlex(pipeline: Pipeline, runId: string, policy: Policy, input: z.input<typeof Options>, budget: Budget, request: typeof fetch = fetch) {
  const options = Options.parse(input); const run = await pipeline.run(runId);
  if (run.status !== 'running') throw new Error('Resume the failed run explicitly before collecting');
  let cursor = options.cursor ?? run.checkpoint.cursor ?? '*', pages = 0;
  try {
    while (pages < options.maxPages) {
      const publicUrl = new URL('https://api.openalex.org/works');
      publicUrl.searchParams.set('filter', `institutions.id:${options.institutionId}`); publicUrl.searchParams.set('per-page', '100'); publicUrl.searchParams.set('cursor', cursor);
      assertAllowed(publicUrl.href, policy);
      if (!await budget.reserve([{ model: 'openalex', tokens: 0 }], 'ingest')) return { pages, cursor, paused: true };
      const requestUrl = new URL(publicUrl); requestUrl.searchParams.set('api_key', options.apiKey);
      const response = await request(requestUrl.href, { redirect: 'manual', signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error('OpenAlex unavailable or rate limited');
      const payload = JSON.parse(await readLimited(response, 10_000_000)); const page = Page.parse(payload);
      // Keep this page's cursor until *all* staging candidates are written. Retrying is idempotent.
      const rawId = await pipeline.record(runId, `page:${cursor}`, publicUrl.href, payload, { cursor });
      for (const work of page.results) {
        const safe = sanitize({ kind: 'paper', name: work.title || work.id, externalId: work.id, sourceUrl: publicUrl.href, parserVersion: policy.parserVersion, facts: { openalexId: work.id, doi: work.doi || '', year: String(work.publication_year || ''), authorships: JSON.stringify(work.authorships || []).slice(0, 10000) } });
        await pipeline.stageCandidate(runId, rawId, safe.payload);
      }
      pages++;
      if (!page.meta.next_cursor) { await pipeline.finish(runId, 'complete'); return { pages, cursor: null, paused: false }; }
      cursor = page.meta.next_cursor; await pipeline.checkpoint(runId, cursor);
    }
    return { pages, cursor, paused: true };
  } catch { await pipeline.finish(runId, 'failed'); throw new Error('OpenAlex collection stopped; resume from the persisted cursor after checking account limits'); }
}

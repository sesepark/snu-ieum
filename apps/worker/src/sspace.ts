import { z } from 'zod';
import { Pipeline } from './pipeline.ts';
import { sanitize } from './privacy.ts';
export const ThesisMetadata = z.strictObject({
  sourceUrl: z.url().refine(value => { const u = new URL(value); return u.protocol === 'https:' && u.hostname === 's-space.snu.ac.kr' && /^\/handle\/10371\/\d+\/?$/.test(u.pathname) && !u.search && !u.hash && !u.port && !u.username && !u.password; }),
  title: z.string().min(1).max(2000), abstract: z.string().max(10000).default(''),
  keywords: z.array(z.string().min(1).max(100)).max(40).default([]),
  advisorNames: z.array(z.string().min(1).max(100)).max(10).default([]),
  department: z.string().max(200).default(''), issuedAt: z.string().max(30).default(''),
  retrievedAt: z.iso.datetime(), permissionConfirmed: z.literal(true),
  licenseNote: z.string().min(1).max(1000), reviewedBy: z.string().min(1).max(100)
}).superRefine((value, ctx) => { if (sanitize(value).exclusions.length) ctx.addIssue({ code: 'custom', message: 'Remove personal contact data before import' }); });
// Explicit fallback: never bypass access controls, scrape a JS application, or download a thesis PDF.
export async function importThesis(pipeline: Pipeline, runId: string, input: z.input<typeof ThesisMetadata>) {
  const metadata = ThesisMetadata.parse(input);
  const rawId = await pipeline.record(runId, metadata.sourceUrl, metadata.sourceUrl, { metadata });
  const stagingId = await pipeline.stageCandidate(runId, rawId, { kind: 'thesis', name: metadata.title, sourceUrl: metadata.sourceUrl, externalId: metadata.sourceUrl, parserVersion: 'sspace-manual-1', facts: {
    abstract: metadata.abstract, keywords: metadata.keywords.join(' · '), department: metadata.department, issuedAt: metadata.issuedAt,
    advisorNames: metadata.advisorNames.join(' · '), identityResolution: 'pending-manual-review', licenseNote: metadata.licenseNote
  } });
  return { rawId, stagingId };
}

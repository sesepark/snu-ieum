import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import { Id } from '@ieum/contracts';
import type { Pipeline } from './pipeline.ts';
const columns = ['id', 'run_id', 'raw_id', 'draft', 'status', 'reviewed_by', 'reviewed_at', 'reason'];
const maxBytes = 2_000_000;
export type ReviewFormat = 'csv' | 'jsonl';
export function exportReviewRows(rows: Record<string, unknown>[], format: ReviewFormat) {
  const quote = (value: unknown) => '"' + (typeof value === 'string' ? value : JSON.stringify(value) ?? '').replaceAll('"', '""') + '"';
  return format === 'csv' ? columns.map(quote).join(',') + '\n' + rows.map(row => columns.map(key => quote(row[key])).join(',')).join('\n') + '\n' : rows.map(row => JSON.stringify(row)).join('\n') + '\n';
}
export function parseReviewRows(text: string, format: ReviewFormat) {
  if (Buffer.byteLength(text, 'utf8') > maxBytes) throw new Error('Review import exceeds 2MB; split the file');
  const rows: unknown[] = format === 'csv' ? parse(text, {
    bom: true, skip_empty_lines: true, max_record_size: maxBytes,
    columns: (header: string[]) => {
      if (new Set(header).size !== header.length || header.some(key => !columns.includes(key))) throw new Error('Unknown or duplicate CSV header');
      return header;
    }
  }) : text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim()).map(line => JSON.parse(line));
  if (!rows.length || rows.length > 1000) throw new Error('Import 1..1000 review rows at a time');
  const envelope = z.object({ run_id: Id, raw_id: Id, draft: z.unknown() });
  return rows.map(input => {
    const row = envelope.parse(input);
    const draft = typeof row.draft === 'string' ? JSON.parse(row.draft) : row.draft;
    return { runId: row.run_id, rawId: row.raw_id, draft };
  });
}
export async function importReviewRows(pipeline: Pick<Pipeline, 'stage' | 'stageCandidate'>, text: string, format: ReviewFormat) {
  const rows = parseReviewRows(text, format); const stagingIds: string[] = [];
  // Revalidate every draft against its original Raw/run reference. Review metadata never grants approval.
  for (const row of rows) {
    const candidate = z.object({ candidate: z.unknown() }).safeParse(row.draft);
    stagingIds.push(candidate.success && candidate.data.candidate !== undefined
      ? await pipeline.stageCandidate(row.runId, row.rawId, candidate.data.candidate)
      : await pipeline.stage(row.runId, row.rawId, row.draft));
  }
  return { stagingIds, status: 'pending-human-review' as const };
}

import { expect, it, vi } from 'vitest';
import { exportReviewRows, importReviewRows, parseReviewRows } from './review-io.ts';
it('round trips quoted CSV and JSONL drafts containing commas, quotes, newlines and Korean', () => {
  const draft = { candidate: { name: '실험실, "표본"', facts: { summary: '첫 줄\n둘째 줄' } } };
  const rows = [{ id: 'row', run_id: 'run', raw_id: 'raw', draft, status: 'pending', reviewed_by: null, reviewed_at: null, reason: '수정, 검수' }];
  for (const format of ['csv', 'jsonl'] as const) expect(parseReviewRows(exportReviewRows(rows, format), format)).toEqual([{ runId: 'run', rawId: 'raw', draft }]);
});
it('uses staging operations and does not trust claimed file approvals', async () => {
  const pipeline = { stage: vi.fn().mockResolvedValue('snapshot-pending'), stageCandidate: vi.fn().mockResolvedValue('candidate-pending') };
  const text = exportReviewRows([{ run_id: 'run', raw_id: 'raw', draft: { manifest: { publication: 'prototype' } }, status: 'approved', reviewed_by: 'forged-file-value' }], 'jsonl');
  const result = await importReviewRows(pipeline, text, 'jsonl');
  expect(result.status).toBe('pending-human-review');
  expect(pipeline.stage).toHaveBeenCalledWith('run', 'raw', { manifest: { publication: 'prototype' } });
  expect(pipeline.stageCandidate).not.toHaveBeenCalled();
});
it('rejects malformed or duplicate CSV headers and invalid original references', () => {
  expect(() => parseReviewRows('run_id,run_id,raw_id,draft\nrun,other,raw,{}', 'csv')).toThrow();
  expect(() => parseReviewRows('{"run_id":"<script>","raw_id":"raw","draft":{}}', 'jsonl')).toThrow();
  expect(() => parseReviewRows('', 'jsonl')).toThrow();
});

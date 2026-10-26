import { expect, it, vi } from 'vitest';
import { importThesis, ThesisMetadata } from './sspace.ts';
import type { Pipeline } from './pipeline.ts';
const metadata = { sourceUrl: 'https://s-space.snu.ac.kr/handle/10371/12345', title: '테스트용 학위논문', retrievedAt: '2026-10-26T00:00:00Z', permissionConfirmed: true as const, licenseNote: 'Fixture permission, not a real license', reviewedBy: 'integration-test', advisorNames: ['동명이인 교수'] };
it('requires a reviewed official handle and permitted metadata', () => {
  expect(ThesisMetadata.safeParse(metadata).success).toBe(true);
  expect(ThesisMetadata.safeParse({ ...metadata, permissionConfirmed: false }).success).toBe(false);
  expect(ThesisMetadata.safeParse({ ...metadata, sourceUrl: 'https://evil.test/10371/12345' }).success).toBe(false);
  expect(ThesisMetadata.safeParse({ ...metadata, abstract: 'private@example.org' }).success).toBe(false);
});
it('stages a thesis as unresolved evidence without linking names to people', async () => {
  const pipeline = { record: vi.fn().mockResolvedValue('raw'), stageCandidate: vi.fn().mockResolvedValue('pending') };
  await importThesis(pipeline as unknown as Pipeline, 'run', metadata);
  const candidate = pipeline.stageCandidate.mock.calls[0][2];
  expect(candidate.kind).toBe('thesis'); expect(candidate.facts.identityResolution).toBe('pending-manual-review'); expect(candidate.resourceIds).toBeUndefined();
});

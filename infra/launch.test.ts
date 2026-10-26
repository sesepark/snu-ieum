import { expect, it } from 'vitest';
import { parseSnapshot } from '@ieum/catalog';
import seed from '../data/prototype.json';
import collegeDraft from '../data/college-draft.json';
import { defaultView, launchCheck } from './launch.ts';
it('cannot release an unreviewed sparse prototype using empty checkmarks', () => {
  const result = launchCheck(parseSnapshot(seed), {});
  expect(result.ready).toBe(false); expect(result.gaps.length).toBeGreaterThan(12);
});
it('chooses the default view at the specified strict thresholds', () => {
  const base = { participants: 10, success2d: 9, success3d: 8, medianSeconds2d: 100, medianSeconds3d: 120, repeatedFatigue3d: false };
  expect(defaultView(base)).toBe('3d');
  expect(defaultView({ ...base, success3d: 7 })).toBe('2d');
  expect(defaultView({ ...base, medianSeconds3d: 121 })).toBe('2d');
  expect(defaultView({ ...base, repeatedFatigue3d: true })).toBe('2d');
});
it('counts official departments rather than shared display groups in search evaluation', () => {
  // Test-only approval and measurements; never publish this in-memory fixture.
  const draft = parseSnapshot(collegeDraft);
  const approved = { ...draft, manifest: { ...draft.manifest, publication: 'approved' as const, reviewedBy: 'test-only-reviewer', reviewedAt: '2026-10-26T00:00:00Z' } };
  const measurements = {
    batchVersion: draft.manifest.version, reviewedBy: 'test-only-reviewer', checkedAt: '2026-10-26T00:00:00Z',
    participants: 8, foundAndOpenedInTwoMinutes: 8, success2d: 8, success3d: 8,
    medianSeconds2d: 90, medianSeconds3d: 90, repeatedFatigue3d: false,
    searchTargets: 12, relevantTopTenPass: 12, searchP95ms: 100, mapInteractiveMs: 500, desktop3dFps: 40,
    keyboardPassed: true, touchTargetsPassed: true, mobilePassed: true, reducedMotionPassed: true,
    snapshotOutagePassed: true, aiFailureFallbackPassed: true, freeAccountVerified: true, backupRestorePassed: true, batchRollbackPassed: true
  };
  expect(approved.departments).toHaveLength(14);
  expect(launchCheck(approved, measurements).ready).toBe(true);
  expect(launchCheck(approved, { ...measurements, searchTargets: 11, relevantTopTenPass: 11 }).gaps).toContain('학과별 검색 평가 80% 미달');
  expect(launchCheck(draft, measurements).gaps).toContain('사람의 공개 배치 승인 대기');
  expect(launchCheck(approved, { ...measurements, batchVersion: 'wrong-test-batch' }).gaps).toContain('검증 기록과 공개 배치 버전 불일치');
});

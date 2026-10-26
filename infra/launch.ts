import { z } from 'zod';
import { catalog } from '@ieum/catalog';
import type { Snapshot } from '@ieum/contracts';
export const LaunchEvidenceSchema = z.strictObject({
  batchVersion: z.string().min(1), reviewedBy: z.string().min(1), checkedAt: z.iso.datetime(),
  participants: z.number().int().min(8), foundAndOpenedInTwoMinutes: z.number().int().nonnegative(),
  success2d: z.number().int().nonnegative(), success3d: z.number().int().nonnegative(),
  medianSeconds2d: z.number().positive(), medianSeconds3d: z.number().positive(), repeatedFatigue3d: z.boolean(),
  searchTargets: z.number().int().positive(), relevantTopTenPass: z.number().int().nonnegative(),
  searchP95ms: z.number().nonnegative().max(1000), mapInteractiveMs: z.number().nonnegative().max(3000), desktop3dFps: z.number().min(30),
  keyboardPassed: z.literal(true), touchTargetsPassed: z.literal(true), mobilePassed: z.literal(true), reducedMotionPassed: z.literal(true),
  snapshotOutagePassed: z.literal(true), aiFailureFallbackPassed: z.literal(true), freeAccountVerified: z.literal(true),
  backupRestorePassed: z.literal(true), batchRollbackPassed: z.literal(true)
}).superRefine((e, ctx) => {
  if ([e.foundAndOpenedInTwoMinutes, e.success2d, e.success3d].some(n => n > e.participants) || e.relevantTopTenPass > e.searchTargets) ctx.addIssue({ code: 'custom', message: 'Invalid evaluation denominators' });
});
export type LaunchEvidence = z.infer<typeof LaunchEvidenceSchema>;
export function defaultView(e: Pick<LaunchEvidence, 'success2d' | 'success3d' | 'participants' | 'medianSeconds2d' | 'medianSeconds3d' | 'repeatedFatigue3d'>) {
  return (e.success2d - e.success3d) * 10 > e.participants || e.medianSeconds3d * 100 > e.medianSeconds2d * 120 || e.repeatedFatigue3d ? '2d' : '3d';
}
export function launchCheck(snapshot: Snapshot, input: unknown) {
  const gaps = [...catalog(snapshot).gaps]; const evidence = LaunchEvidenceSchema.safeParse(input);
  if (!evidence.success) gaps.push('실사용자·성능·장애·복구 검증 기록 미완료');
  else {
    const e = evidence.data;
    if (e.batchVersion !== snapshot.manifest.version) gaps.push('검증 기록과 공개 배치 버전 불일치');
    if (e.foundAndOpenedInTwoMinutes * 5 < e.participants * 4) gaps.push('2분 자원 발견·원문 확인 성공률 80% 미달');
    if (e.searchTargets < snapshot.departments.length || e.relevantTopTenPass * 5 < e.searchTargets * 4) gaps.push('학과별 검색 평가 80% 미달');
  }
  return { ready: gaps.length === 0, gaps, defaultView: evidence.success ? defaultView(evidence.data) : null };
}

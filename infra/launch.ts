import { z } from 'zod';
import { catalog } from '@ieum/catalog';
import { parseCampus, mappedLocations } from '../packages/catalog/src/campus';
import { coverageReport } from '../packages/catalog/src/coverage';
import { sanitize } from '../apps/worker/src/privacy';
import type { Snapshot } from '@ieum/contracts';
export const LaunchEvidenceSchema = z.strictObject({
  batchVersion: z.string().min(1), reviewedBy: z.string().min(1), checkedAt: z.iso.datetime(),
  spatialBatchVersion:z.string().min(1), foundBuildingAndOpenedInTwoMinutes:z.number().int().nonnegative(), relationshipMeaningCorrect:z.number().int().nonnegative(),
  personalContactsExposed:z.literal(0),unverifiedIdentityMerges:z.literal(0),unsourcedRelations:z.literal(0),
  participants: z.number().int().min(8), foundAndOpenedInTwoMinutes: z.number().int().nonnegative(),
  success2d: z.number().int().nonnegative(), success3d: z.number().int().nonnegative(),
  medianSeconds2d: z.number().positive(), medianSeconds3d: z.number().positive(), repeatedFatigue3d: z.boolean(),
  searchTargets: z.number().int().positive(), relevantTopTenPass: z.number().int().nonnegative(),
  searchP95ms: z.number().nonnegative().max(1000), mapInteractiveMs: z.number().nonnegative().max(3000), desktop3dFps: z.number().min(30),
  keyboardPassed: z.literal(true), touchTargetsPassed: z.literal(true), mobilePassed: z.literal(true), reducedMotionPassed: z.literal(true),
  snapshotOutagePassed: z.literal(true), aiFailureFallbackPassed: z.literal(true), freeAccountVerified: z.literal(true),
  backupRestorePassed: z.literal(true), batchRollbackPassed: z.literal(true)
}).superRefine((e, ctx) => {
  if ([e.foundAndOpenedInTwoMinutes,e.foundBuildingAndOpenedInTwoMinutes,e.relationshipMeaningCorrect, e.success2d, e.success3d].some(n => n > e.participants) || e.relevantTopTenPass > e.searchTargets) ctx.addIssue({ code: 'custom', message: 'Invalid evaluation denominators' });
});
export type LaunchEvidence = z.infer<typeof LaunchEvidenceSchema>;
export function defaultView(e: Pick<LaunchEvidence, 'success2d' | 'success3d' | 'participants' | 'medianSeconds2d' | 'medianSeconds3d' | 'repeatedFatigue3d'>) {
  return (e.success2d - e.success3d) * 10 > e.participants || e.medianSeconds3d * 100 > e.medianSeconds2d * 120 || e.repeatedFatigue3d ? '2d' : '3d';
}
export function launchCheck(snapshot: Snapshot, input: unknown, spatial?:{campus:unknown;coverage:unknown}) {
  let quality;let campus;const spatialGaps:string[]=[];
  if(spatial)try{
    campus=parseCampus(spatial.campus,snapshot,true);quality=coverageReport(snapshot,campus,spatial.coverage);
    if(campus.buildings.some(b=>b.number&&b.matchStatus==='candidate'))spatialGaps.push('공식 건물·윤곽 결합 후보 검수 대기');
    if(campus.buildings.some(b=>b.number&&!b.footprint&&!b.omissionReason))spatialGaps.push('공식 건물 표시·누락 사유 미완료');
    if(sanitize({snapshot,campus,coverage:spatial.coverage}).exclusions.length)spatialGaps.push('공개 자료에 연락처 또는 금지 필드 포함');
    const mapped=mappedLocations(campus,snapshot);if(mapped.some(l=>!l.sourceIds.length))spatialGaps.push('지도 위치 출처 누락');
  }catch{spatialGaps.push('공간·연구·수록률 배치 검증 또는 사람 승인 미완료');}
  else spatialGaps.push('공간·전체 목록 수록률 검수 자료 미제공');
  const gaps = [...new Set([...catalog(snapshot,quality).gaps,...spatialGaps])]; const evidence = LaunchEvidenceSchema.safeParse(input);
  if (!evidence.success) gaps.push('실사용자·성능·장애·복구 검증 기록 미완료');
  else {
    const e = evidence.data;
    if(!campus||e.spatialBatchVersion!==campus.manifest.version)gaps.push('검증 기록과 공간 배치 버전 불일치');
    if(e.foundBuildingAndOpenedInTwoMinutes*5<e.participants*4)gaps.push('2분 자원·실제 건물 발견·원문 확인 성공률 80% 미달');
    if(e.relationshipMeaningCorrect*10<e.participants*9)gaps.push('거리·주제·공식 관계 구별 90% 미달');
    if (e.batchVersion !== snapshot.manifest.version) gaps.push('검증 기록과 공개 배치 버전 불일치');
    if (e.foundAndOpenedInTwoMinutes * 5 < e.participants * 4) gaps.push('2분 자원 발견·원문 확인 성공률 80% 미달');
    if (e.searchTargets < catalog(snapshot).departments.length || e.relevantTopTenPass * 5 < e.searchTargets * 4) gaps.push('학과별 검색 평가 80% 미달');
  }
  return { ready: gaps.length === 0, gaps, defaultView: evidence.success ? defaultView(evidence.data) : null };
}

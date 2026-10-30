/** Token-free static release check. Run with Node 24: node --import tsx review/static-release.ts snapshot campus coverage evidence */
import {readFile} from 'node:fs/promises';
import {z} from 'zod';
import {SnapshotSchema} from '@ieum/contracts';
import {parseCampus} from '../packages/catalog/src/campus';
import {coverageReport} from '../packages/catalog/src/coverage';
import {LaunchEvidenceSchema,defaultView} from '../infra/launch';
import {sanitize} from '../apps/worker/src/privacy';
export const StaticEvidenceSchema=z.strictObject(LaunchEvidenceSchema.shape).omit({freeAccountVerified:true,aiFailureFallbackPassed:true}).extend({deploymentMode:z.literal('static'),noExternalAIRequestsPassed:z.literal(true),staticAssetsPassed:z.literal(true)}).superRefine((e,ctx)=>{
 if([e.foundAndOpenedInTwoMinutes,e.foundBuildingAndOpenedInTwoMinutes,e.relationshipMeaningCorrect,e.success2d,e.success3d].some(n=>n>e.participants)||e.relevantTopTenPass>e.searchTargets)ctx.addIssue({code:'custom',message:'Invalid evaluation denominators'});
});
export function checkStatic(snapshotInput:unknown,campusInput:unknown,coverageInput:unknown,evidenceInput:unknown){
 const snapshot=SnapshotSchema.parse(snapshotInput),campus=parseCampus(campusInput,snapshot,true),quality=coverageReport(snapshot,campus,coverageInput),e=StaticEvidenceSchema.parse(evidenceInput);
 const gaps=[...quality.gaps];
 if(e.batchVersion!==snapshot.manifest.version||e.spatialBatchVersion!==campus.manifest.version)gaps.push('평가와 공개 배치 버전 불일치');
 if(e.foundAndOpenedInTwoMinutes/e.participants<.8||e.foundBuildingAndOpenedInTwoMinutes/e.participants<.8)gaps.push('2분 발견·건물·출처 확인 80% 미달');
 if(e.relationshipMeaningCorrect/e.participants<.9)gaps.push('관계 이해 90% 미달');
 if(e.searchTargets<quality.byDepartment.length||e.relevantTopTenPass/e.searchTargets<.8)gaps.push('학과별 검색 평가 80% 미달');
 if(campus.buildings.some(b=>b.number&&b.matchStatus==='candidate'))gaps.push('건물·윤곽 후보 검수 대기');
 if(campus.buildings.some(b=>b.number&&!b.footprint&&!b.omissionReason))gaps.push('건물 누락 사유 대기');
 if(sanitize({snapshot,campus,coverage:coverageInput}).exclusions.length)gaps.push('공개 금지 필드 포함');
 return {ready:gaps.length===0,gaps,defaultView:defaultView(e),deploymentMode:'static'};
}
if(process.argv[1]?.endsWith('static-release.ts')){
 const paths=process.argv.slice(2);if(paths.length!==4)throw new Error('Usage: static-release.ts <snapshot> <campus> <coverage> <static-evidence>');
 const values=await Promise.all(paths.map(async p=>JSON.parse(await readFile(p,'utf8'))));
 const result=checkStatic(...values as [unknown,unknown,unknown,unknown]);console.log(JSON.stringify(result,null,2));if(!result.ready)process.exitCode=1;
}

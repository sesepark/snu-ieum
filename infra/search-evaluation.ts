import{z}from'zod';import{Id,type Snapshot,type Campus}from'@ieum/contracts';import{recommend}from'@ieum/catalog';import{mappedLocations,parseCampus}from'../packages/catalog/src/campus.ts';import{CoverageSchema,type CoverageInput}from'../packages/catalog/src/coverage.ts';import{sanitize,hash}from'../apps/worker/src/privacy.ts';
const Task=z.strictObject({id:Id,targetDepartmentId:Id,task:z.string().min(1),ordinaryQuery:z.string().min(1),departmentFilter:z.null(),relevanceJudgments:z.array(z.unknown()).length(0),topTenResourceIds:z.array(Id).length(0),passed:z.null()});
export const TasksSchema=z.strictObject({template:z.literal(true),evaluationConducted:z.literal(false),approvedBatchVersion:z.null(),reviewStatus:z.literal('pending'),cases:z.array(Task).length(12)});
export function createSearchPack(snapshot:Snapshot,campusInput:unknown,coverageInput:unknown,tasksInput:unknown,now=new Date().toISOString()){
 const campus=parseCampus(campusInput,snapshot),coverage=CoverageSchema.parse(coverageInput),tasks=TasksSchema.parse(tasksInput);
 if(coverage.resourceVersion!==snapshot.manifest.version)throw new Error('Evaluation batch mismatch');
 const departments=new Set(snapshot.departments.filter(d=>d.groupType!=='shared').map(d=>d.id));
 if(new Set(tasks.cases.map(t=>t.id)).size!==12||new Set(tasks.cases.map(t=>t.targetDepartmentId)).size!==12||tasks.cases.some(t=>!departments.has(t.targetDepartmentId)))throw new Error('Keep all 12 official department tasks');
 const locations=mappedLocations(campus,snapshot,Date.parse(now)),sources=[...snapshot.sources,...campus.sources];
 const pack={batchVersion:snapshot.manifest.version,spatialBatchVersion:campus.manifest.version,checkedAt:now,publication:snapshot.manifest.publication,scope:'actual ordinary-search candidates; relevance and student evaluation not yet performed',cases:tasks.cases.map(task=>{
  const results=recommend(snapshot,{q:task.ordinaryQuery,kinds:[],departmentIds:[]},new Map(),Date.parse(now)).slice(0,10);
  return{...task,topTenResourceIds:results.map(r=>r.resource.id),results:results.map(r=>{
   const id=r.resource.id,profile=coverage.profiles.find(p=>p.resourceId===id),position=locations.filter(l=>l.resourceId===id),relations=snapshot.relations.filter(e=>e.from===id||e.to===id);
   const sourceIds=[...new Set([...r.resource.sourceIds,...Object.values(profile?.fields??{}).flatMap(f=>f.sourceIds),...position.flatMap(p=>p.sourceIds),...relations.flatMap(e=>e.sourceIds)])];
   return{resource:r.resource,reason:r.reason,profile:profile??null,locations:position,relations,sources:sourceIds.map(id=>sources.find(s=>s.id===id)).filter(s=>s!==undefined)};
  }),fewerThanThreeCandidates:results.length<3};
 })};
 return{...pack,candidateSha256:hash(JSON.stringify(pack))};
}
export type SearchPack=ReturnType<typeof createSearchPack>;
const Reviewer=Id.refine(s=>sanitize(s).exclusions.length===0,'Use a non-personal reviewer account ID');
export const ReviewsSchema=z.strictObject({candidateSha256:z.string().regex(/^[a-f0-9]{64}$/),batchVersion:Id,spatialBatchVersion:Id,reviews:z.array(z.strictObject({caseId:Id,reviewerId:Reviewer,checkedAt:z.iso.datetime(),judgments:z.array(z.strictObject({resourceId:Id,relevant:z.boolean(),sourceIds:z.array(Id).min(1),reason:z.string().trim().min(1).max(2000)}))}))});
export function scoreSearchPack(pack:SearchPack,input:unknown){
 const reviews=ReviewsSchema.parse(input);
 if(reviews.candidateSha256!==pack.candidateSha256)throw new Error('Candidate facts or task definitions changed');
 if(reviews.batchVersion!==pack.batchVersion||reviews.spatialBatchVersion!==pack.spatialBatchVersion)throw new Error('Review batch mismatch');
 const keys=new Set<string>();
 for(const review of reviews.reviews){
  const task=pack.cases.find(t=>t.id===review.caseId);if(!task)throw new Error('Unknown review task');
  const key=`${review.caseId}:${review.reviewerId}`;if(keys.has(key))throw new Error('Duplicate reviewer case');keys.add(key);
  if(Date.parse(review.checkedAt)<Date.parse(pack.checkedAt))throw new Error('Review predates candidate export');
  if(new Set(review.judgments.map(j=>j.resourceId)).size!==task.results.length||review.judgments.length!==task.results.length)throw new Error('Review every actual top-ten result exactly once');
  for(const j of review.judgments){const result=task.results.find(r=>r.resource.id===j.resourceId);if(!result||j.sourceIds.some(id=>!result.sources.some(s=>s.id===id)))throw new Error('Judgment requires actual resource evidence');}
 }
 const cases=pack.cases.map(task=>{
  const rs=reviews.reviews.filter(r=>r.caseId===task.id),complete=rs.length>=2;
  const relevant=task.results.filter(result=>complete&&rs.every(r=>r.judgments.find(j=>j.resourceId===result.resource.id)?.relevant)).map(r=>r.resource.id);
  return{caseId:task.id,targetDepartmentId:task.targetDepartmentId,reviewers:rs.map(r=>r.reviewerId),candidates:task.results.length,relevantResourceIds:relevant,passed:complete?relevant.length>=3:null};
 });
 const conducted=cases.every(c=>c.passed!==null),passed=cases.filter(c=>c.passed===true).length;
 return{candidateSha256:pack.candidateSha256,batchVersion:pack.batchVersion,spatialBatchVersion:pack.spatialBatchVersion,evaluationConducted:conducted,searchTargets:cases.length,relevantTopTenPass:passed,passRatio:conducted?passed/cases.length:null,targetMet:conducted&&passed*5>=cases.length*4,approvedBatch:pack.publication==='approved',cases};
}

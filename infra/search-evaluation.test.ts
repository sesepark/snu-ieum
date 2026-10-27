import{expect,it}from'vitest';import{SnapshotSchema}from'@ieum/contracts';import snapshot from'../data/college-draft.json';import campus from'../data/campus/campus-draft.json';import coverage from'../data/coverage/coverage-draft.json';import tasks from'../review/evaluation/search-cases.json';import{createSearchPack,scoreSearchPack}from'./search-evaluation';
const pack=createSearchPack(SnapshotSchema.parse(snapshot),campus,coverage,tasks,'2026-10-27T03:00:00Z');
const base={candidateSha256:pack.candidateSha256,batchVersion:pack.batchVersion,spatialBatchVersion:pack.spatialBatchVersion};
it('exports all fixed tasks with actual sourced results while leaving human evaluation pending',()=>{
 expect(pack.cases).toHaveLength(12);expect(pack.cases.every(t=>t.results.length<=10)).toBe(true);expect(pack.cases.flatMap(t=>t.results).every(r=>r.sources.length>0)).toBe(true);
 const result=scoreSearchPack(pack,{...base,reviews:[]});expect(result.evaluationConducted).toBe(false);expect(result.passRatio).toBeNull();expect(result.targetMet).toBe(false);
});
it('rejects unsupported evidence and duplicate reviewer attestations',()=>{
 const task=pack.cases.find(t=>t.results.length>0)!,review={caseId:task.id,reviewerId:'reviewer-a',checkedAt:'2026-10-27T04:00:00Z',judgments:task.results.map(r=>({resourceId:r.resource.id,relevant:true,sourceIds:[r.sources[0].id],reason:'test-only judgment'}))};
 expect(()=>scoreSearchPack(pack,{...base,reviews:[review,review]})).toThrow('Duplicate');
 const wrong=structuredClone(review);wrong.judgments[0].sourceIds=['nonexistent'];expect(()=>scoreSearchPack(pack,{...base,reviews:[wrong]})).toThrow('evidence');
 expect(scoreSearchPack(pack,{...base,reviews:[review]}).cases.find(c=>c.caseId===task.id)?.passed).toBeNull();
});
it('does not accept the same batch name for altered task denominators',()=>{
 const fewer=structuredClone(tasks);fewer.cases.pop();expect(()=>createSearchPack(SnapshotSchema.parse(snapshot),campus,coverage,fewer)).toThrow();
});

it('rejects judgments after source facts or task definitions change under a daily batch ID',()=>{expect(()=>scoreSearchPack(pack,{...base,candidateSha256:'0'.repeat(64),reviews:[]})).toThrow('Candidate facts');});

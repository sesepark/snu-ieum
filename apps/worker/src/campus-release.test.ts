import{expect,it}from'vitest';import{SnapshotSchema,CampusSchema}from'@ieum/contracts';import sdata from'../../../data/college-draft.json';import cdata from'../../../data/campus/campus-draft.json';import vdata from'../../../data/coverage/coverage-draft.json';import{prepareApprovedSpatial}from'./campus-release';
const s=SnapshotSchema.parse(sdata),c=CampusSchema.parse(cdata),date='2026-10-27T00:00:00Z',review={status:'approved',reviewedBy:'test-reviewer',reviewedAt:date,reason:'test-only recorded decision'};
it('requires the exact reviewed research version and a recorded human approval before spatial export',()=>{
 const approved={...s,manifest:{...s.manifest,publication:'approved' as const,reviewedBy:'test-reviewer',reviewedAt:date}};
 expect(()=>prepareApprovedSpatial({campusCandidate:c,coverageCandidate:vdata},{...review,status:'pending'},approved,'test-campus')).toThrow();
 expect(()=>prepareApprovedSpatial({campusCandidate:c,coverageCandidate:vdata},review,s,'test-campus')).toThrow('Approved research');
 expect(()=>prepareApprovedSpatial({campusCandidate:{...c,resourceVersion:'other'},coverageCandidate:vdata},review,approved,'test-campus')).toThrow('versions');
 const result=prepareApprovedSpatial({campusCandidate:c,coverageCandidate:vdata},review,approved,'test-campus',date);
 expect(result.campus.manifest.publication).toBe('approved');expect(result.campus.manifest.reviewedBy).toBe('test-reviewer');expect(result.report.ready).toBe(false);expect(c.manifest.publication).toBe('prototype');
});

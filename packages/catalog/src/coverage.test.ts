import { expect, it } from 'vitest';
import { SnapshotSchema, CampusSchema } from '@ieum/contracts';
import snapshotData from '../../../data/college-draft.json';
import campusData from '../../../data/campus/campus-draft.json';
import inputData from '../../../data/coverage/coverage-draft.json';
import { coverageReport, CoverageSchema, canonicalDoi } from './coverage';
const s=SnapshotSchema.parse(snapshotData),c=CampusSchema.parse(campusData);
it('never treats a sample count as the official denominator or launch completion',()=>{
 const r=coverageReport(s,c,inputData,Date.parse('2026-10-27T01:00:00Z'));
 expect(r.ready).toBe(false);expect(r.byDepartment).toHaveLength(12);
 expect(r.byDepartment.filter(d=>d.researchers.total===null)).toHaveLength(7);
 expect(r.byDepartment.find(d=>d.id==='industrial')!.researchers.total).toBe(14);
 expect(r.byDepartment.find(d=>d.id==='industrial')!.labs.total).toBe(15);
 expect(r.gaps).toContain('관악 공식 건물 전체 목록 대조 대기');
});
it('rejects duplicate official identities and cross-department matches',()=>{
 const input=CoverageSchema.parse(inputData);input.rosters[0].entries.push(input.rosters[0].entries[0]);
 expect(CoverageSchema.safeParse(input).success).toBe(false);
 const wrong=CoverageSchema.parse(inputData);wrong.rosters[0].entries[0].resourceId=s.resources.find(r=>r.departmentId!==wrong.rosters[0].departmentId)!.id;
 expect(()=>coverageReport(s,c,wrong)).toThrow('identity');
});
it('deduplicates DOI variants and excludes unverified and retracted papers',()=>{
 expect(canonicalDoi('https://doi.org/10.1234/ABC')).toBe('10.1234/abc');
 const input=CoverageSchema.parse(inputData),r=s.resources.find(r=>r.kind==='researcher')!;
 const work={id:'work-1',doi:'10.1234/ABC',openalexId:null,title:'test',year:2026,kind:'paper' as const,status:'verified' as const,sourceIds:r.sourceIds,authors:[{resourceId:r.id,identitySourceIds:r.sourceIds,verified:true}]};
 input.works=[work,{...work,id:'work-2',doi:'https://doi.org/10.1234/abc'},{...work,id:'work-3',doi:'10.1234/other',status:'retracted'}];
 const report=coverageReport(s,c,input);expect(report.papers).toBe(1);expect(report.duplicateWorks).toEqual(['work-2']);expect(report.pendingWorks).toBe(1);
});

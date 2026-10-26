import { z } from 'zod';
import { Id, ResourceKind, type Snapshot, type Campus } from '@ieum/contracts';
import departments from '../../../data/departments.json' with { type: 'json' };
import { mappedLocations } from './campus.ts';
const DateTime=z.iso.datetime({offset:true});
const Fact=z.strictObject({value:z.string().trim().min(1).max(2000),sourceIds:z.array(Id).min(1),lastVerifiedAt:DateTime});
export const CoverageSchema=z.strictObject({
  resourceVersion:Id,generatedAt:DateTime,
  rosters:z.array(z.strictObject({departmentId:Id,kind:z.enum(['researcher','lab']),complete:z.boolean(),sourceIds:z.array(Id).min(1),checkedAt:DateTime.nullable(),reason:z.string().min(1),entries:z.array(z.strictObject({externalId:Id,name:z.string().min(1),resourceId:Id.nullable(),status:z.enum(['matched','missing','needs-review']),reason:z.string().nullable()}))})),
  profiles:z.array(z.strictObject({resourceId:Id,fields:z.record(z.string(),Fact)})),
  works:z.array(z.strictObject({id:Id,doi:z.string().nullable(),openalexId:z.string().nullable(),title:z.string().min(1),year:z.number().int().min(1800).max(2200),kind:z.enum(['paper','thesis']),status:z.enum(['verified','needs-review','retracted']),sourceIds:z.array(Id).min(1),authors:z.array(z.strictObject({resourceId:Id,identitySourceIds:z.array(Id).min(1),verified:z.boolean()}))}))
}).superRefine((v,c)=>{
 const keys=v.rosters.map(r=>`${r.departmentId}:${r.kind}`);
 if(new Set(keys).size!==keys.length)c.addIssue({code:'custom',message:'Duplicate roster'});
 if(new Set(v.profiles.map(p=>p.resourceId)).size!==v.profiles.length)c.addIssue({code:'custom',message:'Duplicate profile'});
 for(const r of v.rosters){
  if(new Set(r.entries.map(e=>e.externalId)).size!==r.entries.length)c.addIssue({code:'custom',message:'Duplicate official roster entry'});
  const linked=r.entries.flatMap(e=>e.resourceId?[e.resourceId]:[]);
  if(new Set(linked).size!==linked.length)c.addIssue({code:'custom',message:'Official entries cannot silently merge'});
  if(r.complete&&(!r.checkedAt||!r.entries.length))c.addIssue({code:'custom',message:'Complete roster requires dated entries'});
  for(const e of r.entries)if(e.status==='matched'&&!e.resourceId)c.addIssue({code:'custom',message:'Matched entry needs resource'});
 }
});
export type CoverageInput=z.infer<typeof CoverageSchema>;
export const canonicalDoi=(doi:string)=>doi.trim().toLowerCase().replace(/^https?:\/\/(?:dx\.)?doi\.org\//,'').replace(/^doi:\s*/,'');
export function coverageReport(snapshot:Snapshot,campus:Campus,input:unknown,now=Date.now()){
 const v=CoverageSchema.parse(input);
 if(v.resourceVersion!==snapshot.manifest.version||campus.resourceVersion!==snapshot.manifest.version)throw new Error('Coverage batch version mismatch');
 const sources=new Set([...snapshot.sources,...campus.sources].map(s=>s.id));
 const resources=new Map(snapshot.resources.map(r=>[r.id,r]));
 const allSources=[...v.rosters.flatMap(r=>r.sourceIds),...v.profiles.flatMap(p=>Object.values(p.fields).flatMap(f=>f.sourceIds)),...v.works.flatMap(w=>[...w.sourceIds,...w.authors.flatMap(a=>a.identitySourceIds)])];
 if(allSources.some(id=>!sources.has(id)))throw new Error('Coverage references unknown source');
 for(const r of v.rosters)for(const e of r.entries)if(e.resourceId&&(!resources.has(e.resourceId)||resources.get(e.resourceId)!.departmentId!==r.departmentId||resources.get(e.resourceId)!.kind!==r.kind))throw new Error('Invalid roster resource identity');
 for(const p of v.profiles)if(!resources.has(p.resourceId))throw new Error('Unknown profile resource');
 for(const w of v.works)for(const a of w.authors)if(resources.get(a.resourceId)?.kind!=='researcher')throw new Error('Paper author must be an identified researcher');
 const locationIds=new Set(mappedLocations(campus,snapshot,now).map(l=>l.resourceId));
 const field=(id:string,key:string)=>{
  const f=v.profiles.find(p=>p.resourceId===id)?.fields[key];
  if(!f||/^(?:-|—|n\/?a|unknown|확인 필요|미확인)$/i.test(f.value.trim()))return false;
  const r=resources.get(id)!,ttl=r.kind==='space'||r.kind==='equipment'?7:30;
  const age=(now-Date.parse(f.lastVerifiedAt))/86400000;
  return age>=0&&age<=ttl;
 };
 const detailed=(id:string)=>['researchFields','officialHomepage','affiliation'].every(k=>field(id,k));
 const year=new Date(now).getUTCFullYear();
 const paperMap=new Map<string,CoverageInput['works'][number]>();
 const duplicateWorks:string[]=[],pendingWorks=v.works.filter(w=>w.status!=='verified').length;
 for(const w of v.works.filter(w=>w.status==='verified'&&w.kind==='paper')){
  const key=w.doi?`doi:${canonicalDoi(w.doi)}`:w.openalexId?`oa:${w.openalexId}`:`id:${w.id}`;
  if(paperMap.has(key)){duplicateWorks.push(w.id);continue;}paperMap.set(key,w);
 }
 const papers=[...paperMap.values()];
 const rosterReport=(departmentId:string,kind:'researcher'|'lab')=>{
  const r=v.rosters.find(r=>r.departmentId===departmentId&&r.kind===kind);
  const entries=r?.entries??[];
  const ids=entries.flatMap(e=>e.status==='matched'&&e.resourceId?[e.resourceId]:[]);
  const denominator=r?.complete?entries.length:null;
  const detailedCount=ids.filter(detailed).length,mapped=ids.filter(id=>locationIds.has(id)).length;
  const recent=ids.filter(id=>papers.filter(w=>w.year>=year-4&&w.year<=year&&w.authors.some(a=>a.resourceId===id&&a.verified)).length>=3).length;
  return {kind,total:denominator,observed:entries.length,matched:ids.length,missing:entries.filter(e=>e.status==='missing').length,pending:entries.filter(e=>e.status==='needs-review').length,detailed:detailedCount,mapped,recentEvidence:recent,detailRatio:denominator?detailedCount/denominator:null,locationRatio:denominator?mapped/denominator:null,recentRatio:denominator?recent/denominator:null,reason:r?.reason??'공식 목록 전체 대조 대기',sourceIds:r?.sourceIds??[]};
 };
 const byDepartment=departments.departments.map(d=>({id:d.id,name:d.name,researchers:rosterReport(d.id,'researcher'),labs:rosterReport(d.id,'lab')}));
 const equipment=snapshot.resources.filter(r=>r.kind==='equipment'&&['model','purpose','operator','usageUrl'].every(k=>field(r.id,k))&&locationIds.has(r.id)).length;
 const spaces=snapshot.resources.filter(r=>r.kind==='space'&&['purpose','usageUrl'].every(k=>field(r.id,k))&&locationIds.has(r.id)).length;
 const gaps:string[]=[];
 for(const d of byDepartment){
  for(const r of [d.researchers,d.labs]){
   if(r.total===null)gaps.push(`${d.name} ${r.kind}: 공식 전체 분모 대조 대기`);
   else {if(r.matched!==r.total)gaps.push(`${d.name} ${r.kind}: 전체 목록 미수록·확인 대기`);if((r.detailRatio??0)<.9)gaps.push(`${d.name} ${r.kind}: 상세 90% 미달`);}
  }
  if((d.labs.locationRatio??0)<.9)gaps.push(`${d.name}: 연구실 위치 90% 미달`);
  if((d.researchers.recentRatio??0)<.8)gaps.push(`${d.name}: 현직 교수 최근 논문 80% 미달`);
 }
 if(papers.length<1000)gaps.push(`검수·중복 제거 논문 ${papers.length}/1000`);
 if(equipment<100)gaps.push(`필수 정보·위치 갖춘 장비 ${equipment}/100`);
 if(spaces<20)gaps.push(`용도·공식 이용 안내·위치 갖춘 공간 ${spaces}/20`);
 if(!campus.officialInventoryComplete)gaps.push('관악 공식 건물 전체 목록 대조 대기');
 if(campus.manifest.publication!=='approved'||snapshot.manifest.publication!=='approved')gaps.push('사람의 연구·공간 공개 배치 승인 대기');
 return {resourceVersion:v.resourceVersion,generatedAt:v.generatedAt,byDepartment,papers:papers.length,pendingWorks,duplicateWorks,equipment,spaces,gaps,ready:gaps.length===0};
}
export type CoverageReport=ReturnType<typeof coverageReport>;

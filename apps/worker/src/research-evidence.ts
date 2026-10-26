import{z}from'zod';
import{Id,type Snapshot}from'@ieum/contracts';
import{canonicalDoi,type CoverageInput}from'../../../packages/catalog/src/coverage.ts';
const AuthorId=z.string().regex(/^https:\/\/openalex.org\/A\d+$/),WorkId=z.string().regex(/^https:\/\/openalex.org\/W\d+$/);
export const WorkMetadataSchema=z.strictObject({
 id:WorkId,title:z.string().min(1).max(2000),doi:z.string().nullable(),year:z.number().int().min(1800).max(2200),retracted:z.boolean(),type:z.string(),
 authors:z.array(z.strictObject({id:AuthorId,name:z.string().max(500),orcid:z.string().nullable(),institutionIds:z.array(z.string())})),topics:z.array(z.string().max(500)),sourceId:Id
});
export const AuthorIdentitySchema=z.strictObject({resourceId:Id,openalexAuthorId:AuthorId,officialSourceIds:z.array(Id).min(1),status:z.enum(['verified','needs-review','rejected']),lastVerifiedAt:z.iso.datetime({offset:true}),reason:z.string().min(1)});
export type WorkMetadata=z.infer<typeof WorkMetadataSchema>;
export type AuthorIdentity=z.infer<typeof AuthorIdentitySchema>;
export function selectOpenAlexMetadata(work:any,sourceId:string):WorkMetadata{
 return WorkMetadataSchema.parse({id:work.id,title:work.title||work.display_name,doi:work.doi?canonicalDoi(work.doi):null,year:work.publication_year,retracted:work.is_retracted===true,type:work.type??'unknown',authors:(work.authorships??[]).flatMap((a:any)=>a.author?.id?[{id:a.author.id,name:a.author.display_name??'',orcid:a.author.orcid??null,institutionIds:(a.institutions??[]).map((i:any)=>i.id).filter((v:unknown)=>typeof v==='string')}]:[]),topics:(work.topics??[]).map((t:any)=>t.display_name).filter(Boolean).slice(0,20),sourceId});
}
export function reconcileWorks(snapshot:Snapshot,worksInput:unknown[],identitiesInput:unknown[]){
 const works=worksInput.map(w=>WorkMetadataSchema.parse(w)),identities=identitiesInput.map(i=>AuthorIdentitySchema.parse(i));
 const researcherIds=new Set(snapshot.resources.filter(r=>r.kind==='researcher').map(r=>r.id)),sourceIds=new Set(snapshot.sources.map(s=>s.id));
 for(const i of identities)if(!researcherIds.has(i.resourceId)||i.officialSourceIds.some(id=>!sourceIds.has(id)))throw new Error('Author identity requires known official researcher and sources');
 const verified=identities.filter(i=>i.status==='verified');
 if(new Set(verified.map(i=>i.openalexAuthorId)).size!==verified.length)throw new Error('OpenAlex author is mapped to multiple identities');
 if(new Set(verified.map(i=>i.resourceId)).size!==verified.length)throw new Error('Researcher author identifiers need an explicit merge review');
 const byAuthor=new Map(verified.map(i=>[i.openalexAuthorId,i])),unique=new Map<string,WorkMetadata>(),duplicates:string[]=[];
 for(const w of works){const key=w.doi?`doi:${canonicalDoi(w.doi)}`:`id:${w.id}`;if(unique.has(key)){duplicates.push(w.id);continue;}unique.set(key,w);}
 const coverageWorks:CoverageInput['works']=[],pending:{workId:string;reason:string}[]=[];
 for(const w of unique.values()){
  if(w.retracted){pending.push({workId:w.id,reason:'철회 표시 · 근거 연결 제외'});continue;}
  const authors=w.authors.flatMap(a=>{const i=byAuthor.get(a.id);return i&&a.institutionIds.includes('https://openalex.org/I139264467')?[{resourceId:i.resourceId,identitySourceIds:i.officialSourceIds,verified:true}]:[];});
  if(!authors.length){pending.push({workId:w.id,reason:'공식 현직 공대 연구자와 저자 식별자·논문 소속의 교차 대조 필요'});continue;}
  coverageWorks.push({id:w.id.split('/').at(-1)!,doi:w.doi,openalexId:w.id,title:w.title,year:w.year,kind:'paper',status:'needs-review',sourceIds:[w.sourceId],authors});
 }
 return{works:coverageWorks,pending,duplicates,uniqueWorks:unique.size};
}
export function selectCrossrefStatus(input:unknown,expectedDoi:string){
 const envelope=z.object({message:z.object({DOI:z.string(),title:z.array(z.string()).default([]),'is-referenced-by-count':z.number().optional(),'update-to':z.array(z.object({DOI:z.string().optional(),type:z.string(),updated:z.unknown().optional()})).default([]),relation:z.record(z.string(),z.unknown()).optional()})}).parse(input);
 const message=envelope.message;
 if(canonicalDoi(message.DOI)!==canonicalDoi(expectedDoi))throw new Error('Crossref DOI mismatch');
 const updates=message['update-to'].map(u=>({doi:u.DOI?canonicalDoi(u.DOI):null,type:u.type}));
 return{doi:canonicalDoi(message.DOI),title:message.title[0]??null,updates,retractionOrCorrection:updates.some(u=>/retract|withdraw|correct|errat/i.test(u.type)),reviewRequired:true};
}

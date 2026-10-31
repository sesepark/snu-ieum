import type{Campus,Resource,Snapshot}from'@ieum/contracts';import type{CoverageInput}from'../../../packages/catalog/src/coverage';
import{SpatialSources}from'./BuildingDetail';
const labels:Record<string,string>={researchFields:'연구 분야',officialHomepage:'공식 홈페이지',affiliation:'공식 소속',model:'모델·규격',purpose:'용도·기능',operator:'운영기관',usageUrl:'공식 이용 안내',nfec:'공식 장비 식별자'};
export function ResourceActions({resource,coverage,snapshot}:{resource:Resource;coverage?:CoverageInput;snapshot:Snapshot}) {
 const fields=coverage?.profiles.find(p=>p.resourceId===resource.id)?.fields;
 const links=['officialHomepage','usageUrl'].flatMap(key=>{const fact=fields?.[key];if(!fact)return [];try{const candidate=new URL(fact.value);const url=key==='officialHomepage'&&candidate.protocol==='http:'?new URL(snapshot.sources.find(source=>resource.sourceIds.includes(source.id)&&source.url.startsWith('https:'))?.url??candidate.href):candidate;return url.protocol==='https:'&&!url.username&&!url.password?[{key,url:url.href}]:[];}catch{return [];}});
 return links.length?<div className="resource-actions">{links.map(link=><a key={link.key} href={link.url} target="_blank" rel="noreferrer">{link.key==='officialHomepage'?'공식 홈페이지':'이용 안내'} ↗</a>)}</div>:null;
}
export default function ResourceFacts({resource,campus,snapshot,coverage}:{resource:Resource;campus:Campus;snapshot:Snapshot;coverage:CoverageInput}){
 const profile=coverage.profiles.find(p=>p.resourceId===resource.id);if(!profile)return null;
 const sources={...campus,sources:[...campus.sources,...snapshot.sources.filter(s=>!campus.sources.some(c=>c.id===s.id)).map(s=>({...s,license:'공식 출처',attribution:s.organization,redistribution:'metadata-only' as const,contentUpdatedAt:null}))]};
 return <section className="resource-facts"><h3>정보별 근거</h3>{Object.entries(profile.fields).filter(([key])=>labels[key]).map(([key,fact])=>{let url:string|undefined;try{const u=new URL(fact.value);if(u.protocol==='https:'&&!u.username&&!u.password)url=u.href;}catch{/* Plain factual field. */}return <div key={key}><h4>{labels[key]}</h4>{url?<a href={url} target="_blank" rel="noreferrer">{key==='officialHomepage'?'공식 홈페이지':key==='usageUrl'?'이용 안내':'공식 안내'} ↗</a>:<p>{fact.value}</p>}<p className="fine">사실 확인 {fact.lastVerifiedAt.slice(0,10)} · 원문 갱신일과 다를 수 있음</p><SpatialSources campus={sources} ids={fact.sourceIds}/></div>;})}</section>;
}

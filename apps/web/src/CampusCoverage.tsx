import {useQuery} from '@tanstack/react-query';
import type {Campus,Snapshot} from '@ieum/contracts';
import {coverageReport,CoverageSchema} from '../../../packages/catalog/src/coverage';
import {campusCoverage} from '../../../packages/catalog/src/campus';
export default function CampusCoverage({campus,snapshot}:{campus:Campus;snapshot:Snapshot}){
 const {data}=useQuery({queryKey:['coverage',snapshot.manifest.version,campus.manifest.version],queryFn:async()=>{
  const response=await fetch(`${import.meta.env.BASE_URL}coverage.json`,{signal:AbortSignal.timeout(4000)});if(!response.ok)throw new Error('Coverage unavailable');
  const input=CoverageSchema.parse(await response.json());return coverageReport(snapshot,campus,input);
 },retry:false,staleTime:60_000});
 const c=campusCoverage(campus,snapshot);
 const ratio=(count:number,total:number|null)=>total===null?`${count} / 전체 분모 확인 대기`:`${count} / ${total}`;
 return <section className="campus-coverage"><h3>공간·수집 품질</h3><p>공식 식별 {c.officialIdentified}개 · 윤곽 결합 {c.footprintMatched}개<br/>위치 근거 {c.mappedResources}개 · 위치 미확인 {c.unlocatedResources}개<br/>{c.officialInventoryComplete?'공식 건물 전체 대조 완료':'관악 공식 건물 전체 분모 대조 대기'}</p>{data?data.byDepartment.map(d=><div key={d.id}><strong>{d.name}</strong><span>교수 {ratio(d.researchers.matched,d.researchers.total)}<br/>연구실 {ratio(d.labs.matched,d.labs.total)}<br/>미확인 {d.researchers.pending+d.labs.pending}개 · 위치 {d.labs.mapped}개</span></div>):<p>학과별 공식 전체 분모와 상세 검수 대조 대기</p>}<p>목표: 상세·연구실 위치 90% · 현직 교수 최근 논문 80% · 논문 1,000건 · 장비 100개 · 공간 20곳</p>{data&&<p>새 필수 정보 검수 충족: 논문 {data.papers} · 장비 {data.equipment} · 공간 {data.spaces}<br/>{data.gaps.length}개 기준 미완료 · 사람 공개 승인 전</p>}</section>;
}

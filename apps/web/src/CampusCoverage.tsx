import {useQuery} from '@tanstack/react-query';
import type {Campus,Snapshot} from '@ieum/contracts';
import {loadCoverage} from './client';
import {campusCoverage} from '../../../packages/catalog/src/campus';
export default function CampusCoverage({campus,snapshot}:{campus:Campus;snapshot:Snapshot}){
 const {data:bundle,isPending,error}=useQuery({queryKey:['coverage',snapshot.manifest.version,campus.manifest.version],queryFn:()=>loadCoverage(snapshot,campus),retry:false,staleTime:60_000});
 const data=bundle?.report,c=campusCoverage(campus,snapshot);
 const metrics=[{label:'지도 위치 근거',value:c.mappedResources,total:snapshot.resources.length},{label:'필수 정보 장비',value:data?.equipment??0,total:100},{label:'필수 정보 공간',value:data?.spaces??0,total:20},{label:'저자 검수 논문',value:data?.papers??0,total:1000}];
 return <section className="campus-coverage"><h3>공간·수집 품질</h3><p>연구 배치 {snapshot.manifest.version}<br/>공간 배치 {campus.manifest.version}</p>
 <div className="quality-metrics">{metrics.filter((_,i)=>i===0||Boolean(data)).map(m=><div className="quality-metric" key={m.label}><div><strong>{m.label}</strong><span>{m.value.toLocaleString()} / {m.total.toLocaleString()}</span></div><meter min={0} max={m.total} value={Math.min(m.value,m.total)} aria-label={`${m.label} ${m.value}/${m.total}`}/></div>)}</div>
 <p>위치는 현재 수록 자원 대비입니다. 장비·공간·논문은 출시 목표 대비 필수 검수 충족 수이며 공개 승인 수와 다릅니다.</p>
 <p>공식 건물 식별 {c.officialIdentified}개 · 윤곽 결합 {c.footprintMatched}개<br/>{c.officialInventoryComplete?'공식 건물 전체 대조 완료':'공식 건물 전체 분모 확인 대기'}</p>
 <h3>학과별 연구실 위치</h3>{data?data.byDepartment.map(d=><div className="department-quality" key={d.id}><strong>{d.name}</strong><span>{d.labs.mapped} / {d.labs.total??'분모 미확인'}</span>{d.labs.total!==null&&d.labs.total>0?<meter min={0} max={d.labs.total} value={d.labs.mapped} aria-label={`${d.name} 연구실 위치 ${d.labs.mapped}/${d.labs.total}`}/>:<small>공식 전체 목록 대조 후 수록률 산출</small>}</div>):<p role="status">{isPending?'품질 지표를 불러오는 중…':error?'품질 자료를 열 수 없습니다. 수록 수를 검수 완료 수로 해석하지 마세요.':'학과별 검수 대기'}</p>}
 {data&&<p className="quality-status">{data.ready?'데이터 품질 기준 충족':`${data.gaps.length}개 데이터 기준 확인 필요`} · {snapshot.manifest.publication==='approved'?'공개 승인 배치':'사람 공개 승인 전'}</p>}
 </section>;
}

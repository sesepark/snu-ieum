import {useQuery} from '@tanstack/react-query';
import type {Campus,Snapshot} from '@ieum/contracts';
import {loadCoverage} from './client';
import {campusCoverage} from '../../../packages/catalog/src/campus';
export default function CampusCoverage({campus,snapshot}:{campus:Campus;snapshot:Snapshot}){
 const {data:bundle,isPending,error}=useQuery({queryKey:['coverage',snapshot.manifest.version,campus.manifest.version],queryFn:()=>loadCoverage(snapshot,campus),retry:false,staleTime:60_000});
 const data=bundle?.report,c=campusCoverage(campus,snapshot);
 const metrics=[{label:'지도에 표시된 자원',value:c.mappedResources,total:snapshot.resources.length}];
 return <section className="campus-coverage"><h3>수록 현황</h3>
 <div className="quality-metrics">{metrics.map(m=><div className="quality-metric" key={m.label}><div><strong>{m.label}</strong><span>{m.value.toLocaleString()} / {m.total.toLocaleString()}</span></div><meter min={0} max={m.total} value={Math.min(m.value,m.total)} aria-label={`${m.label} ${m.value}/${m.total}`}/></div>)}</div>
 <p>몇 동 몇 호까지 공식 페이지로 확인된 자원만 지도에 표시합니다. 나머지는 목록에서 찾을 수 있습니다.</p>
 <p>서울대 캠퍼스맵 건물 번호 {c.officialIdentified}개 동 확인</p>
 <h3>학과별 연구실 위치</h3>{data?data.byDepartment.map(d=><div className="department-quality" key={d.id}><strong>{d.name}</strong><span>{d.labs.total!==null?`${d.labs.mapped} / ${d.labs.total}곳`:`${d.labs.mapped}곳`}</span>{d.labs.total!==null&&d.labs.total>0?<meter min={0} max={d.labs.total} value={d.labs.mapped} aria-label={`${d.name} 연구실 위치 ${d.labs.mapped}/${d.labs.total}`}/>:null}</div>):<p role="status">{isPending?'품질 지표를 불러오는 중…':error?'품질 자료를 열 수 없습니다. 수록 수를 검수 완료 수로 해석하지 마세요.':'학과별 검수 대기'}</p>}
 {data&&<p className="quality-status">{snapshot.manifest.publication==='approved'?'학교 승인 자료':'학교 승인 전 시연 자료'}</p>}
 </section>;
}

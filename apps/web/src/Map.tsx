import { Component, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Campus, Snapshot, Graph, Filters } from '@ieum/contracts';
import { buildingModel, homeView, type Viewpoint } from './campus-model';
const TwoD=lazy(()=>import('./Campus2D'));
const ThreeD=lazy(()=>import('./Campus3D'));
class MapBoundary extends Component<{children:ReactNode;onFailure():void},{failed:boolean}>{
 state={failed:false};static getDerivedStateFromError(){return{failed:true};}componentDidCatch(){this.props.onFailure();}render(){return this.state.failed?<p>지도를 열 수 없습니다. 자원·건물 목록에서 탐색해주세요.</p>:this.props.children;}
}
export default function Map(p:{campus?:Campus;snapshot:Snapshot;graph:Graph;filters:Filters;view:'2d'|'3d';selected?:string;building?:string;viewpoint?:Viewpoint;highlighted:Set<string>;searching:boolean;onBuilding(id:string):void;onViewpoint(v:Viewpoint):void;onFallback():void}){
 const container=useRef<HTMLDivElement>(null),handle=useRef<{home():void;zoom(factor:number):void;focus(id:string):void}|null>(null);
 const [size,setSize]=useState({width:800,height:600}),[mobile,setMobile]=useState(()=>matchMedia('(max-width:900px)').matches),[reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
 useEffect(()=>{const observer=new ResizeObserver(([entry])=>setSize({width:Math.max(1,entry.contentRect.width),height:Math.max(1,entry.contentRect.height)}));if(container.current)observer.observe(container.current);return()=>observer.disconnect();},[]);
 useEffect(()=>{const media=matchMedia('(max-width:900px)'),motion=matchMedia('(prefers-reduced-motion: reduce)');const update=()=>{setMobile(media.matches);setReduced(motion.matches);};media.addEventListener('change',update);motion.addEventListener('change',update);return()=>{media.removeEventListener('change',update);motion.removeEventListener('change',update);};},[]);
 const model=useMemo(()=>p.campus?buildingModel(p.campus,p.snapshot,p.filters,p.highlighted,p.graph,p.selected):null,[p.campus,p.snapshot,p.filters,p.highlighted,p.graph,p.selected]);
 const current=useRef(p);current.current=p;
 const onReady=useCallback((value:typeof handle.current)=>{handle.current=value;const q=current.current;if(!q.viewpoint&&(q.selected||q.building))value?.focus(q.selected??q.building!);},[]);
 const previousBuilding=useRef(p.building);
 useEffect(()=>{if(p.building&&p.building!==previousBuilding.current)handle.current?.focus(p.building);previousBuilding.current=p.building;},[p.building]);
 const previous=useRef<string|undefined>(p.selected);
 useEffect(()=>{if(p.selected&&p.selected!==previous.current)handle.current?.focus(p.selected);previous.current=p.selected;},[p.selected,model]);
 const View=p.view==='3d'?ThreeD:TwoD,height=mobile&&p.selected?Math.max(200,Math.floor(size.height*.42)):size.height;
 return <div className="map-stage" ref={container} data-testid="map-stage" aria-label={`${p.view.toUpperCase()} 실제 관악 캠퍼스 지도. 관계 탐색 자원·근거 ${p.graph.nodes.length}개, 연결 ${p.graph.edges.length}개. 자원 목록과 건물 목록에서도 탐색할 수 있습니다.`}>
  {p.campus&&model?<MapBoundary key={p.view} onFailure={p.onFallback}><Suspense fallback={<div className="map-loading" role="status">실제 캠퍼스를 준비하고 있습니다…</div>}><View campus={p.campus} model={model} width={size.width} height={height} selectedBuilding={p.building} searching={p.searching} viewpoint={p.viewpoint??homeView} reducedMotion={reduced} onBuilding={p.onBuilding} onViewpoint={p.onViewpoint} onReady={onReady} onFailure={p.onFallback}/></Suspense></MapBoundary>:<div className="map-loading" role="status">공간 자료 확인 중 · 자원 목록에서 계속 탐색할 수 있습니다.</div>}
  <div className="campus-search"><label htmlFor="building-select">건물 선택</label><select id="building-select" value={p.building??''} onChange={e=>{if(e.target.value){p.onBuilding(e.target.value);handle.current?.focus(e.target.value);}}}><option value="">건물번호 · 이름으로 찾기</option>{p.campus?.buildings.slice().sort((a,b)=>(a.number??'').localeCompare(b.number??'','ko',{numeric:true})).map(b=><option key={b.id} value={b.id}>{b.number?`${b.number}동 `:''}{b.name}{!b.number?` · 공식 식별 대기 ${b.id}`:''}</option>)}</select></div>
  {model&&<p className="campus-unlocated">위치 확인 필요 {model.unlocated}개 · 목록에서 탐색{p.campus?.resourceVersion!==p.snapshot.manifest.version?' · 공간·연구 배치 버전 대조 필요':''}</p>}
  <div className="map-controls" aria-label="지도 조작"><button onClick={()=>handle.current?.home()} aria-label="처음 보기">⌂</button><button onClick={()=>handle.current?.zoom(1.3)} aria-label="확대">＋</button><button onClick={()=>handle.current?.zoom(.77)} aria-label="축소">−</button><button disabled={!p.selected&&!p.building} onClick={()=>{const id=p.selected??p.building;if(id)handle.current?.focus(id);}}>선택으로 이동</button></div>
 </div>;
}

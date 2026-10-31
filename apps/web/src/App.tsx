import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { catalog, graph, recommend, filteredResources } from '@ieum/catalog';
import { loadCatalog, loadCampus, loadCoverage, search } from './client';
import { parseUrl, shareUrl, useExplore } from './state';
import CampusMap from './Map';
import BuildingDetail, { ResourcePosition } from './BuildingDetail';
import CampusCoverage from './CampusCoverage';
import ResourceFacts from './ResourceFacts';
import { mappedLocations, locationLabel } from '../../../packages/catalog/src/campus';
import Filters from './Filters';
import Relations from './Relations';
import AI from './AI';
import type { SearchResponse } from '@ieum/contracts';
import Detail, { kindLabels } from './Detail';
import './tokens.css';
import './styles.css';
import './contest.css';
export default function App() {
  const state = useExplore();
  const [ordinaryResult, setOrdinaryResult] = useState<SearchResponse | null>(null);
  const [aiResult, setAIResult] = useState<SearchResponse | null>(null);
  const [visibleCount, setVisibleCount] = useState(30);
  const [mobileListOpen, setMobileListOpen] = useState(false);
  const returnToList = useRef(false);
  const listToggle = useRef<HTMLButtonElement>(null);
  const select = (id: string) => { returnToList.current = mobileListOpen; const l=campus&&snapshot?mappedLocations(campus,snapshot).find(l=>l.resourceId===id):undefined;state.selectBuilding(l?.buildingId??undefined);state.select(id);setMobileListOpen(false); };
  const { data, isPending, error, refetch } = useQuery({ queryKey: ['catalog'], queryFn: () => loadCatalog(), staleTime: 60_000 });
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const canonicalHash = `#/?${shareUrl(useExplore.getState())}`;
    if (window.location.hash !== canonicalHash) window.history.replaceState(null, '', canonicalHash);
    const unsubscribe = useExplore.subscribe(next => {
      const hash = `#/?${shareUrl(next)}`;
      if (window.location.hash !== hash) window.location.hash = hash;
    });
    const restore = () => useExplore.getState().restore(parseUrl(window.location.hash.split('?')[1] || '', useExplore.getState().view));
    window.addEventListener('hashchange', restore);
    return () => { unsubscribe(); window.removeEventListener('hashchange', restore); };
  }, []);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { useExplore.getState().select(undefined); setMobileListOpen(false); if (matchMedia('(max-width:900px)').matches) listToggle.current?.focus(); else list.current?.focus(); } };
    window.addEventListener('keydown', escape); return () => window.removeEventListener('keydown', escape);
  }, []);
  const snapshot = data?.snapshot;
  const campusQuery=useQuery({queryKey:['campus',snapshot?.manifest.version],queryFn:()=>loadCampus(snapshot!),enabled:Boolean(snapshot),staleTime:60_000});
  const campus=campusQuery.data;
  const metadataQuery=useQuery({queryKey:['coverage',snapshot?.manifest.version,campus?.manifest.version],queryFn:()=>loadCoverage(snapshot!,campus!),enabled:Boolean(snapshot&&campus),retry:false,staleTime:60_000});
  const mappedIds=useMemo(()=>new Set(campus&&snapshot?mappedLocations(campus,snapshot).map(l=>l.resourceId):[]),[campus,snapshot]);
  const filters = useMemo(() => ({ q: state.q, kinds: state.kinds, departmentIds: state.departmentIds }), [state.q, state.kinds, state.departmentIds]);
  useEffect(() => { setAIResult(null); }, [filters, snapshot]);
  useEffect(() => {
    let active = true; setOrdinaryResult(null);
    if (!snapshot || !filters.q) return;
    const timer = setTimeout(() => { search({ ...filters, aiConsent: false }, snapshot).then(result => { if (active) setOrdinaryResult(result); }).catch(() => {}); }, 180);
    return () => { active = false; clearTimeout(timer); };
  }, [snapshot, filters]);
  const results = useMemo(() => aiResult?.results ?? ordinaryResult?.results ?? (snapshot ? recommend(snapshot, filters) : []), [snapshot, filters, aiResult, ordinaryResult]);
  useEffect(() => { setVisibleCount(30); list.current?.scrollTo(0, 0); }, [state.q, state.kinds, state.departmentIds]);
  const distribution = useMemo(() => {
    const totals = new Map<string, number>();
    for (const card of results) totals.set(card.resource.departmentId, (totals.get(card.resource.departmentId) ?? 0) + 1);
    return [...totals].sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0]));
  }, [results]);
  const positions = useMemo(() => new Map(campus && snapshot ? mappedLocations(campus,snapshot).map(l => [l.resourceId, `${campus.buildings.find(b=>b.id===l.buildingId)?.number ?? ''}동 ${l.room ?? ''} · ${locationLabel(l)}`]) : []), [campus,snapshot]);
  const orderedResults = useMemo(() => state.q || aiResult ? results : [...results].sort((a,b) => Number(mappedIds.has(b.resource.id))-Number(mappedIds.has(a.resource.id)) || ({lab:0,researcher:1,equipment:2,space:3}[a.resource.kind]-{lab:0,researcher:1,equipment:2,space:3}[b.resource.kind])), [results,state.q,aiResult,mappedIds]);
  const graphData = useMemo(() => snapshot ? graph(snapshot, filters, { focus: state.focusOnly ? state.selected : undefined, selected:state.selected, depth: state.depth, evidence: state.evidence, expanded: state.focusOnly }) : { nodes: [], edges: [], hiddenNodes: 0, hiddenEdges: 0 }, [snapshot, filters, state.selected, state.focusOnly, state.depth, state.evidence]);
  const highlighted = useMemo(() => new Set(results.map(r => r.resource.id)), [results]);
  const counts = useMemo(() => snapshot ? catalog(snapshot) : null, [snapshot]);
  const filterCounts = useMemo(() => snapshot ? catalog({ ...snapshot, resources: filteredResources(snapshot, { q: state.q, kinds: [], departmentIds: [] }) }) : null, [snapshot, state.q]);
  const resource = snapshot?.resources.find(r => r.id === state.selected);
  const selectedCard = resource && snapshot ? recommend(snapshot, { q: '', kinds: [], departmentIds: [] }).find(r => r.resource.id === resource.id) : undefined;
  const departments = useMemo(() => snapshot?.departments.filter(d => !state.departmentIds.length || state.departmentIds.includes(d.id)) ?? [], [snapshot, state.departmentIds]);
  if (isPending) return <main className="loading-screen" role="status"><strong>서울대 이음</strong><p>공식 출처가 있는 연구 자원을 불러옵니다…</p></main>;
  if (error || !snapshot || !counts) return <main className="loading-screen"><h1>지식지도를 불러오지 못했습니다.</h1><p>연결 상태를 확인하고 다시 시도해주세요.</p><button onClick={() => refetch()}>다시 불러오기</button></main>;
  return <div className="explorer">
    <a className="skip-link" href="#resource-list" onClick={event => { event.preventDefault(); list.current?.focus(); }}>자원 목록으로 바로가기</a>
    <header className="site-header"><a className="wordmark" href="#/" onClick={event => { event.preventDefault(); state.reset(); setAIResult(null); setMobileListOpen(false); }}><img src="/snu-ieum/identity/snu-emblem.png" alt="" aria-hidden="true" />서울대 이음</a><span className="header-divider" /><span className="header-subtitle">관악 연구지도</span><div className="header-right"><span className="live-dot" />공식 출처 기반 <span className="prototype-label">{snapshot.manifest.publication === 'prototype' ? '공모전 시연' : '공개 배치'}</span><details className="demo-info"><summary>자료 안내</summary><div><strong>직접 탐색해 보세요</strong><p>검색·지도·상세·공식 출처는 로그인 없이 사용할 수 있습니다. 현재 자료는 사람 승인 전 검수 초안이며, 장비·공간의 이용 조건은 공식 안내에서 확인해 주세요.</p><p>공대 12개 학과·공용시설을 수록했습니다. 위치가 확인되지 않은 자원은 목록에서 찾을 수 있습니다. 수록 범위와 검수 상태는 지도 아래 자료 안내에서 확인하세요.</p><p>제작: 박세환 · 학생 제작 연구자원 탐색 서비스</p><a href="https://github.com/sesepark/snu-ieum" target="_blank" rel="noreferrer">개발 기록 보기 ↗</a></div></details></div></header>
    <div className="mobile-controls"><button ref={listToggle} onClick={() => setMobileListOpen(!mobileListOpen)} aria-expanded={mobileListOpen} aria-controls="search-panel">{mobileListOpen ? '지도로 돌아가기' : '검색 · 자원 목록'}</button><span>{results.length}개 자원</span></div>
    <main className={`workspace ${resource ? 'has-detail' : ''}`}>
      <aside id="search-panel" className={`search-panel ${state.q || state.kinds.length || state.departmentIds.length ? 'is-searching' : ''} ${mobileListOpen ? 'mobile-open' : ''}`} aria-label="검색과 자원 목록"><div className="intro"><p className="eyebrow">서울대학교 연구자원 지도</p><h1>관심 분야로 찾고,<br />위치까지 확인하세요.</h1><p className="intro-copy">연구실과 장비의 공식 정보를 한곳에서.</p></div>
        <form className="search-box" onSubmit={event => event.preventDefault()}><label className="sr-only" htmlFor="search">자원명·연구 분야 검색</label><span aria-hidden="true">⌕</span><input id="search" type="search" placeholder="이름, 연구 분야, 키워드" value={state.q} maxLength={300} onChange={event => state.setQuery(event.target.value)} /><kbd aria-hidden="true">↵</kbd></form>
        <div className="example-queries" aria-label="검색 예시"><span>이렇게 찾아보세요</span>{['시계열', '로봇', '초저온'].map(query=><button key={query} onClick={()=>{state.reset();state.setQuery(query);}}>{query}<span aria-hidden="true">↗</span></button>)}</div>

        <Filters catalog={filterCounts ?? counts} />

        {state.q && distribution.length>0 && <details className="result-distribution"><summary>{distribution.length}개 학과·기관에서 찾았습니다</summary><p>현재 수록 자료의 검색 결과입니다.</p>{distribution.map(([id,total])=><button key={id} onClick={()=>state.setDepartments([id])}><span>{snapshot.departments.find(d=>d.id===id)?.name ?? id}</span><meter min={0} max={results.length} value={total} aria-label={`${snapshot.departments.find(d=>d.id===id)?.name ?? id} 검색 결과 비중`}/><strong>{total}</strong></button>)}</details>}
        {data.aiAvailable && <AI available={data.aiAvailable} snapshot={snapshot} filters={filters} onResult={setAIResult} />}
        <div className="list-heading"><h2>{state.q || aiResult ? '검색 결과' : '수록 자원'}</h2><span aria-live="polite">{results.length}개</span></div>
        <div className="resource-list" id="resource-list" tabIndex={-1} ref={list} aria-label="키보드로 탐색 가능한 자원 목록">{results.length ? orderedResults.slice(0,visibleCount).map(card => <button className={`resource-card ${card.resource.id === state.selected ? 'selected' : ''}`} key={card.resource.id} onClick={() => select(card.resource.id)} aria-pressed={card.resource.id === state.selected}><span className={`kind-mark ${card.resource.kind}`} aria-hidden="true" /><span className="resource-card-body"><span className="card-meta">{kindLabels[card.resource.kind]} · {snapshot.departments.find(d => d.id === card.resource.departmentId)?.name}</span><strong>{card.resource.name}</strong><span className="card-summary">{card.resource.summary}</span>{(state.q || aiResult) && <span className="card-reason" title={card.reason}>{card.resource.keywords.filter(word => word.toLocaleLowerCase().includes(state.q.toLocaleLowerCase())).slice(0, 2).join(' · ') || `“${state.q}” 관련 공식 소개`}</span>}<span className="card-location">{positions.get(card.resource.id) || '위치 확인 필요'}</span><span className="card-provenance">공식 출처 {card.source.length} · {card.lastVerifiedAt.slice(0, 10)}{card.verificationRequired ? ' · 재확인 필요' : ''}</span></span><span className="card-arrow" aria-hidden="true">↗</span></button>) : <div className="empty-state"><strong>수록된 결과가 없습니다.</strong><p>검색어나 필터를 바꿔보세요. 아직 수집되지 않은 자원이 있을 수 있습니다.</p>{state.q && <button className="text-button" onClick={() => state.setQuery('')}>검색어 지우기</button>}<div className="empty-suggestions">{['로봇','시계열','초저온'].map(q=><button key={q} onClick={()=>{state.setKinds([]);state.setDepartments([]);state.setQuery(q);}}>{q} 살펴보기</button>)}</div></div>}{results.length>visibleCount && <button className="load-more" onClick={()=>setVisibleCount(n=>n+30)}>30개 더 보기 · {Math.min(visibleCount,results.length)}/{results.length}</button>}</div>
        <div className="data-note"><span className="live-dot" /><span>자료 확인 {snapshot.manifest.generatedAt.slice(0, 10)}<small>수록 자원 {snapshot.resources.length}개 · {snapshot.manifest.publication === 'approved' ? '승인된 공개 자료' : '사람 승인 전 검수 초안'}</small></span><button className="text-button" onClick={() => refetch()}>갱신</button></div>
      </aside>
      <section className="map-panel" aria-label="전체 지식지도"><div className="map-heading"><div><span className="eyebrow">EXPLORE CONNECTIONS</span><h2>관악캠퍼스 <span>공대 {departments.filter(d => d.groupType === 'department').length}개 학과{departments.some(d => d.groupType === 'shared') ? ' · 공용시설' : ''}</span></h2></div><div className="view-switch" aria-label="지도 뷰"><button aria-pressed={state.view === '2d'} onClick={() => state.setView('2d')}>2D</button><button aria-pressed={state.view === '3d'} onClick={() => state.setView('3d')}>3D</button></div></div>
        <CampusMap campus={campus} snapshot={snapshot} graph={graphData} filters={filters} view={state.view} selected={state.selected} building={state.building} college={state.college} onCollege={state.selectCollege} viewpoint={state.viewpoint} highlighted={highlighted} searching={Boolean(state.q || aiResult)} onBuilding={state.selectBuilding} onViewpoint={state.setViewpoint} onFallback={state.fallback} />
        {campusQuery.error && <p className="campus-load-error">공간 자료를 열지 못했습니다. 검색과 자원 목록은 계속 사용할 수 있습니다.</p>}
        {campus && state.building && !resource && <BuildingDetail campus={campus} snapshot={snapshot} id={state.building} filterIds={highlighted} onSelect={select} onClose={()=>state.selectBuilding(undefined)}/>}

        <div className="map-footer"><details className="legend"><summary>지도 읽는 법</summary>{Object.entries(kindLabels).map(([kind, name]) => <span key={kind}><i className={`kind-mark ${kind}`} />{name}</span>)}<p>실제 건물 위치 · 높이는 개략 표현 포함.<br />가까운 위치·같은 주제는 협업 관계가 아닙니다.<br />지형은 약 30m DSM · 정밀 지면고도 아님.</p></details><details className="coverage"><summary>자료 안내 · 수록 범위 <span>↗</span></summary><div className="coverage-content">{campus && <CampusCoverage campus={campus} snapshot={snapshot}/>}{(graphData.hiddenNodes > 0 || graphData.hiddenEdges > 0) && <p>관계 보기에서 생략된 자원·근거 {graphData.hiddenNodes}개 · 연결 {graphData.hiddenEdges}개. 학과·유형을 좁혀 확인하세요. 지도 위치 미확인 수와 다른 집계입니다.</p>}<h3>유형별 수록 수</h3><p>수록 수와 검수 충족 수는 다릅니다. 공식 전체 분모가 확인되지 않은 학과는 수록률을 계산하지 않습니다.</p>{[...counts.departments, ...counts.sharedGroups].map(d => <div key={d.id}><strong>{d.name}</strong><span>교수 {d.counts.researcher} · 연구실 {d.counts.lab}<br />장비 {d.counts.equipment} · 공간 {d.counts.space}</span><small>{d.lastVerifiedAt?.slice(0, 10) || '수록 대기'}</small></div>)}</div></details></div>
        <div className="status-notice" role="status">{state.notice || (state.selected && !resource ? '이 배치에 없는 자원입니다. 목록에서 다른 자원을 선택해주세요.' : '')}</div>
      <div className="campus-attribution">{campus?.sources.filter(s=>s.id==='osm'||s.id==='copernicus-dem').map(source=><a key={source.id} href={source.url} target="_blank" rel="noreferrer">{source.id==='osm'?'© OpenStreetMap contributors · ODbL':'Copernicus DEM · DLR / Airbus / EU / ESA'}</a>)}</div></section>
      {resource && <Detail resource={resource} snapshot={snapshot} verificationRequired={Boolean(selectedCard?.verificationRequired)} position={campus && <ResourcePosition campus={campus} snapshot={snapshot} resource={resource} onBuilding={state.selectBuilding}/>} onSelect={select} onClose={() => { state.select(undefined); if (returnToList.current) setMobileListOpen(true); if (matchMedia('(max-width:900px)').matches) listToggle.current?.focus(); else list.current?.focus(); }}><Relations snapshot={snapshot} resource={resource} />{campus&&metadataQuery.data&&<ResourceFacts resource={resource} campus={campus} snapshot={snapshot} coverage={metadataQuery.data.coverage}/>}</Detail>}
    </main>
  </div>;
}

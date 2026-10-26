import { Component, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Department, Graph } from '@ieum/contracts';
import { model, type MapHandle } from './map-model';
const TwoD = lazy(() => import('./Map2D'));
const ThreeD = lazy(() => import('./Map3D'));
class MapBoundary extends Component<{ children: ReactNode; onFailure(): void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? <p>지도를 열 수 없습니다. 자원 목록에서 탐색해주세요.</p> : this.props.children; }
}
export default function Map({ graph, departments, focused, view, selected, highlighted, searching, onSelect, onFallback }: { graph: Graph; departments: Department[]; focused: boolean; view: '2d' | '3d'; selected?: string; highlighted: Set<string>; searching: boolean; onSelect(id: string): void; onFallback(): void }) {
  const container = useRef<HTMLDivElement>(null); const handle = useRef<MapHandle | null>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [mobile, setMobile] = useState(() => matchMedia('(max-width:900px)').matches);
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const data = useMemo(() => model(graph, departments, focused), [graph, departments, focused]);
  useEffect(() => { const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height })); if (container.current) observer.observe(container.current); return () => observer.disconnect(); }, []);
  useEffect(() => { const media = matchMedia('(prefers-reduced-motion: reduce)'); const listener = () => setReduced(media.matches); media.addEventListener('change', listener); return () => media.removeEventListener('change', listener); }, []);
  useEffect(() => { const media = matchMedia('(max-width:900px)'); const listener = () => setMobile(media.matches); media.addEventListener('change', listener); return () => media.removeEventListener('change', listener); }, []);
  const visibleHeight = mobile && selected ? Math.max(200, Math.floor(size.height * .42)) : size.height;
  const onReady = useCallback((value: MapHandle) => { handle.current = value; }, []);
  const View = view === '3d' ? ThreeD : TwoD;
  return <div className="map-stage" ref={container} data-testid="map-stage" aria-label={`${view.toUpperCase()} 지식지도. 자원·근거 ${graph.nodes.length}개, 연결 ${graph.edges.length}개. 자원 목록에서도 같은 항목을 선택할 수 있습니다.`}>
    <MapBoundary key={view} onFailure={onFallback}><Suspense fallback={<div className="map-loading" role="status">관계망을 준비하고 있습니다…</div>}><View {...data} width={size.width} height={visibleHeight} focusSelection={mobile && Boolean(selected)} selected={selected} highlighted={highlighted} searching={searching} reducedMotion={reduced} onSelect={onSelect} onReady={onReady} onFailure={onFallback} /></Suspense></MapBoundary>
    <div className="map-controls" aria-label="지도 조작"><button onClick={() => handle.current?.home()} aria-label="처음 보기">⌂</button><button onClick={() => handle.current?.zoom(1.3)} aria-label="확대">＋</button><button onClick={() => handle.current?.zoom(.77)} aria-label="축소">−</button><button disabled={!selected} onClick={() => selected && handle.current?.focus(selected)}>선택으로 이동</button></div>
  </div>;
}

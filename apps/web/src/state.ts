import { create } from 'zustand';
import { FiltersSchema, type Filters } from '@ieum/contracts';
import { type Viewpoint } from './campus-model';
type View = '2d' | '3d';
export type SharedState = { view: View; selected?: string; kinds: Filters['kinds']; departmentIds: string[]; building?: string; college?:string; viewpoint?: Viewpoint };
const validId = (id: string | null) => id && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(id) ? id : undefined;
export function parseUrl(search: string, defaultView: View = '2d'): SharedState {
  const params = new URLSearchParams(search);
  const parsed = FiltersSchema.safeParse({ q: '', kinds: params.get('kind')?.split(',').filter(Boolean) ?? [], departmentIds: params.get('department')?.split(',').filter(Boolean) ?? [] });
  const values=params.get('camera')?.split(',').map(Number);
  const viewpoint=values?.length===5 && values.every(Number.isFinite) && Math.abs(values[0])<=6000 && Math.abs(values[1])<=6000 && values[2]>=.2 && values[2]<=20 && Math.abs(values[3])<=360 && values[4]>=15 && values[4]<=85 ? {x:values[0],y:values[1],zoom:values[2],bearing:values[3],pitch:values[4]} : undefined;
  return { college:validId(params.get('college')), building: validId(params.get('building')), viewpoint, view: params.get('view') === '3d' ? '3d' : params.get('view') === '2d' ? '2d' : defaultView, selected: validId(params.get('selected')), kinds: parsed.success ? parsed.data.kinds : [], departmentIds: parsed.success ? parsed.data.departmentIds : [] };
}
export function shareUrl(state: SharedState) {
  const params = new URLSearchParams({ view: state.view });
  if (state.kinds.length) params.set('kind', [...state.kinds].sort().join(','));
  if (state.departmentIds.length) params.set('department', [...state.departmentIds].sort().join(','));
  if (state.selected) params.set('selected', state.selected);
  if (state.building) params.set('building',state.building);
  if(state.college)params.set('college',state.college);
  if (state.viewpoint) { const v=state.viewpoint;params.set('camera',[v.x,v.y,v.zoom,v.bearing,v.pitch].map(n=>Number(n.toFixed(3))).join(',')); }
  return params.toString();
}
const initialView = import.meta.env.VITE_DEFAULT_VIEW === '2d' ? '2d' : import.meta.env.VITE_DEFAULT_VIEW === '3d' ? '3d' : typeof matchMedia === 'function' && matchMedia('(min-width: 901px)').matches ? '3d' : '2d';
export const useExplore = create<SharedState & {
  q: string; depth: 1 | 2; focusOnly: boolean; evidence: boolean; notice: string;
  restore(shared: SharedState): void; setView(view: View): void; select(id?: string): void; selectBuilding(id?:string): void; selectCollege(id?:string):void; setViewpoint(v:Viewpoint): void;
  reset(): void;
  setQuery(q: string): void; setKinds(kinds: Filters['kinds']): void; setDepartments(ids: string[]): void;
  expand(): void; setFocusOnly(value: boolean): void; setEvidence(value: boolean): void; fallback(): void;
}>(set => ({
  view: initialView, building: undefined, viewpoint: undefined, kinds: [], departmentIds: [], q: '', selected: undefined, depth: 1, focusOnly: false, evidence: false, notice: '',
  restore: shared => set({building:undefined,college:undefined,viewpoint:undefined,...shared}), selectCollege:college=>set({college,building:undefined,selected:undefined}), selectBuilding: building => set({building,selected:undefined,focusOnly:false}), setViewpoint: viewpoint=>set({viewpoint}), setView: view => set({ view, notice: '' }), select: selected => set({ selected, depth: 1, evidence: false }),
  reset: () => set({ view: initialView, q: '', kinds: [], departmentIds: [], selected: undefined, building: undefined, college: undefined, viewpoint: undefined, depth: 1, focusOnly: false, evidence: false, notice: '' }),
  setQuery: q => set({ q, selected: undefined, building: undefined, depth: 1, focusOnly: false, evidence: false }), setKinds: kinds => set({ kinds, selected: undefined, building: undefined, depth: 1, focusOnly: false, evidence: false }), setDepartments: departmentIds => set({ departmentIds, selected: undefined, building: undefined, depth: 1, focusOnly: false, evidence: false }),
  expand: () => set({ depth: 2, focusOnly: true }), setFocusOnly: focusOnly => set({ focusOnly }), setEvidence: evidence => set({ evidence }),
  fallback: () => set({ view: '2d', notice: '3D를 사용할 수 없어 2D로 전환했습니다. 자원 목록에서도 탐색할 수 있습니다.' })
}));

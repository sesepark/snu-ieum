import { create } from 'zustand';
import { FiltersSchema, type Filters } from '@ieum/contracts';
type View = '2d' | '3d';
export type SharedState = { view: View; selected?: string; kinds: Filters['kinds']; departmentIds: string[] };
const validId = (id: string | null) => id && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(id) ? id : undefined;
export function parseUrl(search: string, defaultView: View = '2d'): SharedState {
  const params = new URLSearchParams(search);
  const parsed = FiltersSchema.safeParse({ q: '', kinds: params.get('kind')?.split(',').filter(Boolean) ?? [], departmentIds: params.get('department')?.split(',').filter(Boolean) ?? [] });
  return { view: params.get('view') === '3d' ? '3d' : params.get('view') === '2d' ? '2d' : defaultView, selected: validId(params.get('selected')), kinds: parsed.success ? parsed.data.kinds : [], departmentIds: parsed.success ? parsed.data.departmentIds : [] };
}
export function shareUrl(state: SharedState) {
  const params = new URLSearchParams({ view: state.view });
  if (state.kinds.length) params.set('kind', [...state.kinds].sort().join(','));
  if (state.departmentIds.length) params.set('department', [...state.departmentIds].sort().join(','));
  if (state.selected) params.set('selected', state.selected);
  return params.toString();
}
const initialView = import.meta.env.VITE_DEFAULT_VIEW === '2d' ? '2d' : import.meta.env.VITE_DEFAULT_VIEW === '3d' ? '3d' : typeof matchMedia === 'function' && matchMedia('(min-width: 901px)').matches ? '3d' : '2d';
export const useExplore = create<SharedState & {
  q: string; depth: 1 | 2; focusOnly: boolean; evidence: boolean; notice: string;
  restore(shared: SharedState): void; setView(view: View): void; select(id?: string): void;
  setQuery(q: string): void; setKinds(kinds: Filters['kinds']): void; setDepartments(ids: string[]): void;
  expand(): void; setFocusOnly(value: boolean): void; setEvidence(value: boolean): void; fallback(): void;
}>(set => ({
  view: initialView, kinds: [], departmentIds: [], q: '', selected: undefined, depth: 1, focusOnly: false, evidence: false, notice: '',
  restore: shared => set(shared), setView: view => set({ view, notice: '' }), select: selected => set({ selected, depth: 1, evidence: false }),
  setQuery: q => set({ q }), setKinds: kinds => set({ kinds }), setDepartments: departmentIds => set({ departmentIds }),
  expand: () => set({ depth: 2, focusOnly: true }), setFocusOnly: focusOnly => set({ focusOnly }), setEvidence: evidence => set({ evidence }),
  fallback: () => set({ view: '2d', notice: '3D를 사용할 수 없어 2D로 전환했습니다. 자원 목록에서도 탐색할 수 있습니다.' })
}));

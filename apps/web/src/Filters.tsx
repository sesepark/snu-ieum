import type { Catalog, Resource } from '@ieum/contracts';
import { kindLabels } from './Detail';
import { useExplore } from './state';
export default function Filters({ catalog }: { catalog: Catalog }) {
  const { kinds, departmentIds, setKinds, setDepartments, setQuery } = useExplore();
  const active = kinds.length > 0 || departmentIds.length > 0;
  return <div className="filters">
    <fieldset><legend className="sr-only">자원 유형 필터</legend><button type="button" aria-pressed={!kinds.length} onClick={() => setKinds([])}>전체 <span>{Object.values(catalog.totals).reduce((a, b) => a + b, 0)}</span></button>{Object.entries(kindLabels).map(([kind, label]) => <button type="button" key={kind} aria-pressed={kinds.includes(kind as Resource['kind'])} onClick={() => setKinds(kinds.includes(kind as Resource['kind']) ? kinds.filter(k => k !== kind) : [...kinds, kind as Resource['kind']])}>{label} <span>{catalog.totals[kind as Resource['kind']]}</span></button>)}</fieldset>
    <div className="department-filter"><label className="sr-only" htmlFor="department">학과 필터</label><select id="department" value={departmentIds[0] || ''} onChange={event => setDepartments(event.target.value ? [event.target.value] : [])}><option value="">모든 학과 · {catalog.departments.length}</option>{[...catalog.departments, ...catalog.sharedGroups].map(d => <option value={d.id} key={d.id}>{d.name} · {Object.values(d.counts).reduce((a, b) => a + b, 0)}개</option>)}</select>{active && <button className="text-button" onClick={() => { setKinds([]); setDepartments([]); setQuery(''); }}>초기화</button>}</div>
  </div>;
}

import { useMemo } from 'react';
import type { Campus, Snapshot } from '@ieum/contracts';
import { egoNetwork, evidenceGlow, glow, type EgoNode } from './network';
import { kindLabels } from './Detail';

const W = 316, H = 300, CX = W / 2, CY = 128;
const short = (name: string, n = 9) => name.length > n ? `${name.slice(0, n - 1)}…` : name;

/** Radial diagram of one resource: official relations inside, 2-step and paper evidence outside, same-building context faint. */
export default function EgoGraph({ snapshot, campus, id, onSelect }: { snapshot: Snapshot; campus?: Campus; id: string; onSelect(id: string): void }) {
  const ego = useMemo(() => egoNetwork(snapshot, campus, id, { colocated: 5 }), [snapshot, campus, id]);
  const layout = useMemo(() => {
    if (!ego) return [];
    const placed = new Map<string, { x: number; y: number; angle: number }>();
    const first = ego.nodes.filter(n => n.ring === 1).slice(0, 10);
    const second = ego.nodes.filter(n => n.ring === 2).slice(0, 10);
    const third = ego.nodes.filter(n => n.ring === 3).slice(0, 5);
    const out: (EgoNode & { x: number; y: number; px: number; py: number })[] = [];
    first.forEach((n, i) => {
      const angle = -Math.PI / 2 + (i / Math.max(1, first.length)) * Math.PI * 2;
      const x = CX + Math.cos(angle) * 78, y = CY + Math.sin(angle) * 72; placed.set(n.resource.id, { x, y, angle });
      out.push({ ...n, x, y, px: CX, py: CY });
    });
    second.forEach((n, i) => {
      const parent = n.via ? placed.get(n.via) : undefined;
      const siblings = second.filter(m => m.via === n.via), k = siblings.indexOf(n);
      const angle = parent ? parent.angle + (k - (siblings.length - 1) / 2) * .42 : Math.PI / 4 + (i / Math.max(1, second.length)) * Math.PI * 2;
      const x = CX + Math.cos(angle) * 128, y = CY + Math.sin(angle) * 104;
      out.push({ ...n, x, y, px: parent?.x ?? CX, py: parent?.y ?? CY });
    });
    third.forEach((n, i) => {
      out.push({ ...n, x: 34 + (i + .5) * ((W - 68) / third.length), y: H - 40, px: CX, py: CY });
    });
    return out;
  }, [ego]);
  if (!ego) return null;
  const hidden = ego.nodes.length - layout.length;
  const building = ego.buildingId ? campus?.buildings.find(b => b.id === ego.buildingId) : undefined;
  return <section className="ego-graph" aria-label="연결 지도">
    <div className="ego-graph-head"><h3>연결 지도</h3><span>{ego.nodes.filter(n => n.ring === 1).length}개 직접 연결</span></div>
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${ego.center.name}의 연결: ${layout.filter(n => n.ring < 3).map(n => `${n.relation} ${n.resource.name}`).join(', ') || '공식 연결 없음'}`}>
      <defs>
        <radialGradient id="ego-bg" cx="50%" cy="45%" r="65%"><stop offset="0" stopColor="#1d2a6e" /><stop offset="1" stopColor="#0a1030" /></radialGradient>
        <filter id="ego-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <rect width={W} height={H} rx="18" fill="url(#ego-bg)" />
      {layout.some(n => n.ring === 3) && <><line x1="20" x2={W - 20} y1={H - 62} y2={H - 62} stroke="#7f9bff" strokeOpacity=".18" /><text x="20" y={H - 68} fill="#9aa6d8" fontSize="8.5" fontWeight="700" letterSpacing=".8">같은 건물 · 협업 관계 아님</text></>}{[72, 110].map(r => <ellipse key={r} cx={CX} cy={CY} rx={r * 1.08} ry={r} fill="none" stroke="#7f9bff" strokeOpacity=".14" strokeDasharray="2 5" />)}
      {layout.filter(n => n.ring < 3).map(n => <line key={`e-${n.resource.id}`} className={`ego-edge ring-${n.ring}`} x1={n.px} y1={n.py} x2={n.x} y2={n.y} stroke={n.ring === 3 ? '#9aa6d8' : n.relation.includes('논문') ? evidenceGlow : glow[n.resource.kind]} strokeOpacity={n.ring === 3 ? .35 : .85} strokeWidth={n.ring === 1 ? 2 : 1.3} strokeDasharray={n.ring === 3 ? '2 4' : n.relation.includes('논문') ? '5 4' : undefined} />)}
      {layout.map(n => <g key={n.resource.id} className={`ego-node ring-${n.ring}`} role="button" tabIndex={0} aria-label={`${n.relation} · ${kindLabels[n.resource.kind]} ${n.resource.name}`} onClick={() => onSelect(n.resource.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(n.resource.id); } }}>
        <title>{`${n.relation} · ${n.resource.name}${n.buildingId ? '' : ' · 위치 확인 필요'}`}</title>
        <circle cx={n.x} cy={n.y} r={n.ring === 1 ? 8 : n.ring === 3 ? 5 : 6} fill={glow[n.resource.kind]} fillOpacity={n.ring === 3 ? .45 : 1} filter={n.ring === 3 ? undefined : 'url(#ego-glow)'} />
        <text x={n.x} y={n.ring === 3 ? n.y + 17 : n.y + (n.y >= CY ? 19 : -12)} textAnchor="middle" fill="#e8ecff" fillOpacity={n.ring === 3 ? .55 : .95} fontSize="9.5">{short(n.resource.name, n.ring === 3 ? 6 : 9)}</text>
      </g>)}
      <circle cx={CX} cy={CY} r="24" fill={glow[ego.center.kind]} fillOpacity=".16" />
      <circle cx={CX} cy={CY} r="13" fill={glow[ego.center.kind]} filter="url(#ego-glow)" />
      {!layout.length && <text x={CX} y={CY - 40} textAnchor="middle" fill="#c9d2ff" fontSize="10">공식 근거가 있는 연결이 아직 없습니다</text>}
    </svg>
    <ul className="ego-legend">
      <li><i style={{ background: `linear-gradient(90deg,${glow.researcher},${glow.lab},${glow.equipment},${glow.space})` }} />공식 연결 · 점 색 = 종류</li>
      <li><i className="dash" style={{ borderColor: evidenceGlow }} />논문 근거</li>
      <li><i className="dot" />같은 건물 · 관계 아님</li>
    </ul>
    <p className="fine">{building ? `${building.number ? `${building.number}동 ` : ''}${building.name}에 위치 · ` : '위치 확인 필요 · '}선은 공식 출처에 적힌 관계만 뜻합니다.{hidden > 0 ? ` 연결 ${hidden}개는 목록에서 확인하세요.` : ''}</p>
  </section>;
}

import { useEffect, useRef } from 'react';
import { project, pickLabels, homeView, type CampusViewProps } from './campus-model';
import { evidenceGlow, glow, kindOrder, type Kind } from './network';
import { kindLabels } from './Detail';

type Hit = { id: string; x: number; y: number; r: number };
const deptHue = (id: string) => { let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; };
const short = (text: string, n: number) => text.length > n ? `${text.slice(0, n - 1)}…` : text;

export default function Campus2D(p: CampusViewProps) {
  const canvas = useRef<HTMLCanvasElement>(null), latest = useRef(p); latest.current = p;
  const view = useRef(p.viewpoint); view.current = p.viewpoint;
  useEffect(() => {
    const node = canvas.current; if (!node) return;
    let drag: { x: number; y: number; vx: number; vy: number; distance: number } | null = null;
    let staticLayer: { key: string; canvas: HTMLCanvasElement } | undefined;
    let egoHits: Hit[] = [], frame = 0, disposed = false;
    const scale = () => Math.min(latest.current.width / 2400, latest.current.height / 3100) * view.current.zoom;
    const transform = () => { const q = latest.current, k = scale(), v = view.current; return { k, to: (x: number, y: number): [number, number] => [q.width / 2 + (x - v.x) * k, q.height / 2 + (y - v.y) * k] }; };

    const drawStatic = (ctx: CanvasRenderingContext2D) => {
      const q = latest.current, { k, to } = transform();
      const bg = ctx.createRadialGradient(q.width * .55, q.height * .2, 0, q.width * .55, q.height * .2, Math.max(q.width, q.height));
      bg.addColorStop(0, '#1b2672'); bg.addColorStop(.45, '#0b1342'); bg.addColorStop(1, '#040719');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, q.width, q.height);
      const t = q.campus.terrain;
      if (t) {
        const cw = (t.east - t.west) * 88300 / t.columns * k, ch = (t.north - t.south) * 111200 / t.rows * k;
        for (let j = 0; j < t.rows; j++) for (let i = 0; i < t.columns; i++) {
          const h = t.heights[j * t.columns + i]; if (h === null) continue;
          const [x, y] = project([t.west + (i + .5) / t.columns * (t.east - t.west), t.north - (j + .5) / t.rows * (t.north - t.south)]), [sx, sy] = to(x, y);
          if (sx < -cw || sy < -ch || sx > q.width + cw || sy > q.height + ch) continue;
          const band = Math.floor(h / 25);
          ctx.fillStyle = `hsl(230 48% ${11 + Math.min(1, h / 600) * 13 + (band % 2) * 1.6}%)`;
          ctx.fillRect(sx - cw / 2, sy - ch / 2, cw + 1, ch + 1);
        }
      }
      const step = 200 * k; if (step > 24) { ctx.strokeStyle = '#7f9bff10'; ctx.lineWidth = 1; const [ox, oy] = to(0, 0); ctx.beginPath(); for (let x = ox % step; x < q.width; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, q.height); } for (let y = oy % step; y < q.height; y += step) { ctx.moveTo(0, y); ctx.lineTo(q.width, y); } ctx.stroke(); }
      const path = (points: readonly number[][], close = false) => { ctx.beginPath(); points.forEach((pt, i) => { const [x, y] = to(...project(pt)); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); if (close) ctx.closePath(); };
      for (const road of q.campus.paths) {
        path(road.points, road.kind === 'green');
        if (road.kind === 'green') { ctx.fillStyle = '#1d6b5a40'; ctx.fill(); continue; }
        ctx.strokeStyle = road.kind === 'road' ? '#8fa6ff70' : '#5868b050'; ctx.lineWidth = Math.max(.7, road.kind === 'road' ? 5 * k : 1.2 * k); ctx.stroke();
      }
      const egoBuildings = new Map<string, Kind>();
      if (q.ego) { for (const n of q.ego.nodes) if (n.buildingId && n.ring < 3 && !egoBuildings.has(n.buildingId)) egoBuildings.set(n.buildingId, n.resource.kind); if (q.ego.buildingId) egoBuildings.set(q.ego.buildingId, q.ego.center.kind); }
      const stacked = new Set(q.network?.stacks.map(s => s.buildingId));
      for (const m of q.model.markers) {
        const b = m.building, selected = b.id === q.selectedBuilding, hit = q.searching && m.matched > 0, college = q.college && b.collegeIds.includes(q.college), ego = egoBuildings.get(b.id), active = stacked.has(b.id) || m.resourceIds.length > 0;
        ctx.fillStyle = selected ? '#4d63ec' : ego ? glow[ego] + '99' : hit ? '#ffb547cc' : q.searching ? '#1a2150' : college ? '#2f87b0' : active ? '#3a4fb8' : '#252f6b';
        ctx.strokeStyle = selected ? '#ffffff' : ego ? glow[ego] : hit ? '#ffd28a' : active ? '#8fa6ff' : '#7d93ff40'; ctx.lineWidth = selected ? 2 : Math.max(.6, k * .8);
        ctx.shadowColor = selected ? '#8ea2ff' : ego ? glow[ego] : hit ? '#ffb547' : active ? '#3d5cf0' : 'transparent'; ctx.shadowBlur = selected || ego || hit ? 18 : active ? 10 : 0;
        if (b.footprint) { ctx.beginPath(); for (const ring of b.footprint.coordinates) { ring.forEach((pt, i) => { const [x, y] = to(...project(pt)); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.closePath(); } ctx.fill('evenodd'); ctx.stroke(); }
        else { const [x, y] = to(...m.center); ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
        ctx.shadowBlur = 0;
      }
    };

    const redraw = (time = performance.now()) => {
      const q = latest.current, ctx = node.getContext('2d'); if (!ctx) return;
      const ratio = Math.min(devicePixelRatio || 1, 2), w = Math.round(q.width * ratio), h = Math.round(q.height * ratio);
      if (node.width !== w || node.height !== h) { node.width = w; node.height = h; }
      const v = view.current, key = [w, h, v.x, v.y, v.zoom, q.selectedBuilding, q.college, q.searching, q.model.markers.length, q.model.markers.reduce((n, m) => n + m.matched, 0), q.ego?.center.id, q.network?.stacks.length].join('|');
      if (!staticLayer || staticLayer.key !== key) {
        const layer = staticLayer?.canvas ?? document.createElement('canvas'); layer.width = w; layer.height = h;
        const lctx = layer.getContext('2d')!; lctx.setTransform(ratio, 0, 0, ratio, 0, 0); drawStatic(lctx); staticLayer = { key, canvas: layer };
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(staticLayer.canvas, 0, 0); ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      const { k, to } = transform(), seconds = q.reducedMotion ? 0 : time / 1000;
      const centers = new Map(q.model.markers.map(m => [m.building.id, to(...m.center)]));
      const layers = q.layers ?? new Set(['official', 'evidence', 'department']);
      // Network arcs
      if (q.network) {
        const egoBuildings = new Set(q.ego ? [q.ego.buildingId, ...q.ego.nodes.map(n => n.buildingId)].filter(Boolean) as string[] : []);
        for (const link of q.network.links) {
          if (!layers.has(link.layer)) continue;
          const a = centers.get(link.from), b = centers.get(link.to); if (!a || !b) continue;
          const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, bend = link.layer === 'department' ? .18 : .3;
          const cx = (a[0] + b[0]) / 2 - dy / d * d * bend, cy = (a[1] + b[1]) / 2 + dx / d * d * bend;
          const dim = q.ego && !(egoBuildings.has(link.from) && egoBuildings.has(link.to));
          ctx.globalAlpha = dim || q.searching ? .18 : link.layer === 'department' ? .5 : 1;
          if (link.layer === 'department') { const hue = deptHue(link.departmentId ?? link.id); ctx.strokeStyle = `hsl(${hue} 80% 66%)`; ctx.lineWidth = 1.2; }
          else if (link.layer === 'evidence') { ctx.strokeStyle = evidenceGlow; ctx.lineWidth = 2.4; }
          else { const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]); g.addColorStop(0, glow[link.fromKind ?? 'researcher']); g.addColorStop(1, glow[link.toKind ?? 'lab']); ctx.strokeStyle = g; ctx.lineWidth = Math.min(4.5, 1.8 + link.weight * .5); }
          ctx.shadowColor = typeof ctx.strokeStyle === 'string' ? ctx.strokeStyle : '#b69cff'; ctx.shadowBlur = link.layer === 'department' ? 0 : 10;
          ctx.setLineDash(link.layer === 'department' ? [3, 6] : [10, 8]); ctx.lineDashOffset = -seconds * (link.layer === 'department' ? 10 : 28);
          ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(cx, cy, b[0], b[1]); ctx.stroke();
        }
        ctx.setLineDash([]); ctx.shadowBlur = 0; ctx.globalAlpha = 1;
        // Composition donuts
        const glyph = Math.max(.75, Math.min(1.6, Math.sqrt(v.zoom)));
        const matched = new Map(q.model.markers.map(m => [m.building.id, m.matched]));
        for (const stack of q.network.stacks) {
          const c = centers.get(stack.buildingId); if (!c) continue;
          const hits = q.searching ? matched.get(stack.buildingId) ?? 0 : 0;
          const r = (7 + Math.sqrt(stack.total) * 2.6) * glyph; let start = -Math.PI / 2; ctx.globalAlpha = q.ego || (q.searching && !hits) ? .22 : 1;
          ctx.beginPath(); ctx.arc(c[0], c[1], r + 3, 0, Math.PI * 2); ctx.fillStyle = '#060a24e6'; ctx.fill();
          for (const kind of kindOrder) { const n = stack.counts[kind]; if (!n) continue; const end = start + n / stack.total * Math.PI * 2; ctx.beginPath(); ctx.arc(c[0], c[1], r, start, end); ctx.strokeStyle = glow[kind]; ctx.lineWidth = 3.6 * glyph; ctx.shadowColor = glow[kind]; ctx.shadowBlur = 8; ctx.stroke(); start = end; }
          ctx.shadowBlur = 0;
          if (stack.internalRelations) { const phase = (seconds * .6) % 1; ctx.beginPath(); ctx.arc(c[0], c[1], r + 6 + phase * 10, 0, Math.PI * 2); ctx.strokeStyle = `rgba(182,156,255,${q.reducedMotion ? .5 : .6 * (1 - phase)})`; ctx.lineWidth = 1.5; ctx.stroke(); }
          if (hits) { ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(c[0], c[1], r + 7, 0, Math.PI * 2); ctx.strokeStyle = '#ffbe55'; ctx.lineWidth = 3; ctx.shadowColor = '#ffbe55'; ctx.shadowBlur = 16; ctx.stroke(); ctx.shadowBlur = 0; ctx.fillStyle = '#ffbe55'; ctx.font = `900 ${Math.round(11 * glyph)}px Pretendard,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(r > 16 ? `검색 ${hits}` : String(hits), c[0], c[1] + .5); }
          else if (r > 12 && !q.ego && !q.searching) { ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.round(10 * glyph)}px Pretendard,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(stack.total), c[0], c[1] + .5); }
          ctx.globalAlpha = 1;
        }
      }
      // Labels
      const occupied: { x: number; y: number; w: number; h: number }[] = [];
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const pill = (x: number, y: number, text: string, strong: boolean, accent?: string) => {
        ctx.font = `${strong ? '800' : '600'} 11px Pretendard,sans-serif`; const w = ctx.measureText(text).width + 18, h = 24;
        if (!strong && (x < 0 || x > q.width || y < 0 || y > q.height || occupied.some(r => Math.abs(x - r.x) < (w + r.w) / 2 + 4 && Math.abs(y - r.y) < (h + r.h) / 2 + 4))) return;
        occupied.push({ x, y, w, h }); ctx.fillStyle = strong ? '#4d63ec' : '#090d2ae0'; ctx.strokeStyle = accent ?? (strong ? '#ffffffaa' : '#8fa6ff55'); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, 12); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.fillText(text, x, y + .5);
      };
      // Ego constellation (screen space)
      egoHits = [];
      if (q.ego) {
        const ego = q.ego, home = ego.buildingId ?? ego.nodes.find(n => n.buildingId && n.ring < 3)?.buildingId ?? q.network?.hubs.get(ego.center.departmentId);
        const anchor = home ? centers.get(home) : undefined, [ax, ay] = anchor ? [anchor[0], anchor[1] - 90] : [q.width / 2, q.height / 2 - 40];
        const rings = { 1: ego.nodes.filter(n => n.ring === 1).slice(0, 12), 2: ego.nodes.filter(n => n.ring === 2).slice(0, 10), 3: ego.nodes.filter(n => n.ring === 3).slice(0, 6) } as const;
        const placed = new Map<string, [number, number]>();
        const points: { id: string; x: number; y: number; ring: number; kind: Kind; name: string; relation: string; buildingId?: string; px: number; py: number }[] = [];
        for (const ring of [1, 2, 3] as const) {
          const list = rings[ring], radius = Math.max(ring === 1 ? 105 : ring === 2 ? 170 : 140, list.length * (ring === 3 ? 30 : 24));
          list.forEach((n, i) => {
            const angle = -Math.PI / 2 + (i / Math.max(1, list.length)) * Math.PI * 2 + ring * .5, x = ax + Math.cos(angle) * radius, y = ay + Math.sin(angle) * radius * .72;
            const parent = ring === 2 && n.via ? placed.get(n.via) : undefined;
            placed.set(n.resource.id, [x, y]);
            points.push({ id: n.resource.id, x, y, ring, kind: n.resource.kind, name: n.resource.name, relation: n.relation, buildingId: n.buildingId, px: parent?.[0] ?? ax, py: parent?.[1] ?? ay });
          });
        }
        for (const pt of points) {
          const target = pt.buildingId ? centers.get(pt.buildingId) : undefined;
          if (target && pt.ring < 3) { ctx.setLineDash([3, 4]); ctx.strokeStyle = glow[pt.kind] + '99'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pt.x, pt.y); ctx.lineTo(target[0], target[1]); ctx.stroke(); ctx.setLineDash([]); ctx.beginPath(); ctx.arc(target[0], target[1], 6 + ((seconds * .8) % 1) * 8, 0, Math.PI * 2); ctx.strokeStyle = glow[pt.kind] + 'aa'; ctx.stroke(); }
          ctx.strokeStyle = pt.ring === 3 ? '#9aa6d866' : pt.relation.includes('논문') ? evidenceGlow : glow[pt.kind]; ctx.lineWidth = pt.ring === 1 ? 2.2 : 1.4;
          ctx.setLineDash(pt.ring === 3 ? [2, 5] : [9, 7]); ctx.lineDashOffset = -seconds * 30; ctx.shadowColor = glow[pt.kind]; ctx.shadowBlur = pt.ring === 3 ? 0 : 8;
          ctx.beginPath(); ctx.moveTo(pt.px, pt.py); ctx.lineTo(pt.x, pt.y); ctx.stroke(); ctx.setLineDash([]); ctx.shadowBlur = 0;
        }
        if (anchor) { ctx.setLineDash([3, 4]); ctx.strokeStyle = glow[ego.center.kind]; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(anchor[0], anchor[1]); ctx.stroke(); ctx.setLineDash([]); }
        for (const pt of points) {
          const r = pt.ring === 1 ? 7 : pt.ring === 2 ? 5.5 : 4.5;
          ctx.globalAlpha = pt.ring === 3 ? .6 : 1; ctx.fillStyle = glow[pt.kind]; ctx.shadowColor = glow[pt.kind]; ctx.shadowBlur = 14;
          ctx.beginPath(); ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
          ctx.font = `${pt.ring === 1 ? 700 : 600} 10.5px Pretendard,sans-serif`; ctx.textAlign = 'center';
          const label = short(pt.name, pt.ring === 3 ? 10 : 14), lw = ctx.measureText(label).width + 12, ly = pt.y + (pt.y >= ay ? 17 : -17);
          ctx.fillStyle = '#070b24d9'; ctx.beginPath(); ctx.roundRect(pt.x - lw / 2, ly - 9, lw, 18, 9); ctx.fill(); ctx.fillStyle = pt.ring === 3 ? '#c9d0f0' : '#fff'; ctx.fillText(label, pt.x, ly + .5);
          ctx.globalAlpha = 1; occupied.push({ x: pt.x, y: ly, w: lw, h: 18 }); egoHits.push({ id: pt.id, x: pt.x, y: pt.y, r: Math.max(12, r + 6) });
        }
        ctx.beginPath(); ctx.arc(ax, ay, 22, 0, Math.PI * 2); ctx.fillStyle = glow[ego.center.kind] + '2a'; ctx.fill();
        ctx.beginPath(); ctx.arc(ax, ay, 11, 0, Math.PI * 2); ctx.fillStyle = glow[ego.center.kind]; ctx.shadowColor = glow[ego.center.kind]; ctx.shadowBlur = 22; ctx.fill(); ctx.shadowBlur = 0;
        pill(ax, ay - 34, `${kindLabels[ego.center.kind]} · ${short(ego.center.name, 22)}`, true, glow[ego.center.kind]);
      }
      for (const m of pickLabels(q.model, q.selectedBuilding, q.searching, v.zoom)) {
        if (q.ego && m.building.id !== q.selectedBuilding) continue;
        const c = centers.get(m.building.id)!, stack = q.network?.stacks.find(s => s.buildingId === m.building.id), r = stack ? (7 + Math.sqrt(stack.total) * 2.6) * Math.max(.75, Math.min(1.6, Math.sqrt(v.zoom))) : 0;
        pill(c[0], c[1] - r - 18, `${m.building.number ? m.building.number + '동 ' : ''}${m.building.name}${q.searching ? ' · 검색 ' + m.matched : m.resourceIds.length ? ' · ' + m.resourceIds.length : ''}`, m.building.id === q.selectedBuilding);
      }
      if (v.zoom < 2 && !q.selectedBuilding && !q.searching && !q.ego) {
        for (const college of q.model.colleges) {
          const [x, y] = to(...college.center); ctx.font = '800 12px Pretendard,sans-serif'; const w = Math.max(ctx.measureText(college.name).width, 90) + 26, h = 44;
          if (occupied.some(r => Math.abs(x - r.x) < (w + r.w) / 2 + 8 && Math.abs(y - r.y) < (h + r.h) / 2 + 8)) continue;
          occupied.push({ x, y, w, h }); ctx.fillStyle = college.id === q.college ? '#1a4766ee' : '#090d2ad9'; ctx.strokeStyle = college.id === q.college ? '#5cc8ff' : '#ffffff2a';
          ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, 12); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#fff'; ctx.fillText(college.name, x, y - 7); ctx.font = '600 10px Pretendard,sans-serif'; ctx.fillStyle = '#a9b3e6'; ctx.fillText(`건물 ${college.buildingIds.length} · 수록 ${college.resourceCount}`, x, y + 10);
        }
      }
      ctx.fillStyle = '#c6cdf5'; ctx.textAlign = 'left'; ctx.font = '700 11px Pretendard,sans-serif'; ctx.fillText('N ↑', q.width - 120, 190);
      const bar = 100 * k; ctx.fillRect(q.width - 120, 216, bar, 2); ctx.fillText('100 m', q.width - 120, 206);
    };
    const loop = (time: number) => {
      if (disposed) return; frame = requestAnimationFrame(loop);
      const q = latest.current; if (document.hidden || q.reducedMotion) return;
      if (q.ego || q.network?.links.length) redraw(time);
    };
    frame = requestAnimationFrame(loop);
    const commit = () => latest.current.onViewpoint({ ...view.current });
    const zoom = (f: number) => { view.current = { ...view.current, zoom: Math.max(.2, Math.min(20, view.current.zoom * f)) }; redraw(); commit(); };
    const handle = {
      home: () => { view.current = homeView; redraw(); commit(); }, zoom,
      focus: (id: string) => {
        const q = latest.current, college = q.model.colleges.find(c => `college:${c.id}` === id);
        if (college) { view.current = { ...view.current, x: college.center[0], y: college.center[1], zoom: 1.7 }; redraw(); commit(); return; }
        const home = q.ego && q.ego.center.id === id ? q.ego.buildingId ?? q.network?.hubs.get(q.ego.center.departmentId) : undefined;
        const m = q.model.markers.find(mm => mm.building.id === (home ?? id) || mm.resourceIds.includes(id));
        if (m) { view.current = { ...view.current, x: m.center[0], y: m.center[1] - (home ? 30 : 0), zoom: home ? 3.2 : 4 }; redraw(); commit(); }
      },
    };
    latest.current.onReady(handle);
    const down = (e: PointerEvent) => { drag = { x: e.clientX, y: e.clientY, vx: view.current.x, vy: view.current.y, distance: 0 }; node.setPointerCapture(e.pointerId); };
    const move = (e: PointerEvent) => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.distance = Math.hypot(dx, dy); view.current = { ...view.current, x: Math.max(-6000, Math.min(6000, drag.vx - dx / scale())), y: Math.max(-6000, Math.min(6000, drag.vy - dy / scale())) }; redraw(); };
    const up = (e: PointerEvent) => {
      if (!drag) return; const clicked = drag.distance < 5; drag = null; if (!clicked) { commit(); return; }
      const rect = node.getBoundingClientRect(), sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      const egoHit = egoHits.find(h => Math.hypot(h.x - sx, h.y - sy) < h.r);
      if (egoHit) { latest.current.onResource?.(egoHit.id); return; }
      const x = (sx - latest.current.width / 2) / scale() + view.current.x, y = (sy - latest.current.height / 2) / scale() + view.current.y;
      const q = latest.current; let best: string | undefined, dist = Infinity;
      for (const m of q.model.markers) { const d = Math.hypot(m.center[0] - x, m.center[1] - y); if (d < Math.max(22 / scale(), 35) && d < dist) { dist = d; best = m.building.id; } }
      if (best) q.onBuilding(best);
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const wheel = (e: WheelEvent) => { e.preventDefault(); view.current = { ...view.current, zoom: Math.max(.2, Math.min(20, view.current.zoom * Math.exp(-e.deltaY * .001))) }; redraw(); clearTimeout(timer); timer = setTimeout(commit, 180); };
    const key = (e: KeyboardEvent) => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) { e.preventDefault(); const step = 80 / view.current.zoom; view.current = { ...view.current, x: view.current.x + (e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0), y: view.current.y + (e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0) }; redraw(); commit(); } else if (e.key === '+' || e.key === '=') zoom(1.3); else if (e.key === '-') zoom(.77); else if (e.key === 'Home') handle.home(); };
    node.addEventListener('pointerdown', down); node.addEventListener('pointermove', move); node.addEventListener('pointerup', up); node.addEventListener('wheel', wheel, { passive: false }); node.addEventListener('keydown', key);
    const cancel = () => { drag = null; }; node.addEventListener('pointercancel', cancel);
    redraw(); const render = () => redraw(); node.addEventListener('campus-redraw', render);
    return () => { disposed = true; cancelAnimationFrame(frame); clearTimeout(timer); node.removeEventListener('pointerdown', down); node.removeEventListener('pointermove', move); node.removeEventListener('pointerup', up); node.removeEventListener('wheel', wheel); node.removeEventListener('keydown', key); node.removeEventListener('pointercancel', cancel); node.removeEventListener('campus-redraw', render); };
  }, []);
  useEffect(() => { canvas.current?.dispatchEvent(new Event('campus-redraw')); }, [p]);
  return <canvas ref={canvas} style={{ width: p.width, height: p.height, touchAction: 'none' }} tabIndex={0} aria-label="2D 실제 관악 캠퍼스. 방향키 이동, 더하기·빼기 확대, 건물 목록에서 선택." />;
}

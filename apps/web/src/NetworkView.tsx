import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending, AmbientLight, BufferAttribute, BufferGeometry, CanvasTexture, Color, DynamicDrawUsage, Fog, InstancedMesh, LineBasicMaterial, LineSegments,
  Matrix4, PerspectiveCamera, Points, PointsMaterial, Raycaster, Scene, SphereGeometry, MeshBasicMaterial, Vector2, Vector3, WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Filters, Snapshot } from '@ieum/contracts';
import { filteredResources } from '@ieum/catalog';
import { evidenceGlow, glow } from './network';
import { kindLabels } from './Detail';

export type NetworkHandle = { home(): void; zoom(factor: number): void; focus(id: string): void };
type Props = { snapshot: Snapshot; filters: Filters; highlighted: Set<string>; searching: boolean; selected?: string; width: number; height: number; reducedMotion: boolean; onResource(id: string): void; onReady(handle: NetworkHandle): void; onFailure(): void };

function seeded(seed: number) { return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }; }
let dot: CanvasTexture | undefined;
function dotTexture() {
  if (dot) return dot;
  const c = document.createElement('canvas'); c.width = c.height = 64; const ctx = c.getContext('2d')!, g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  return dot = new CanvasTexture(c);
}

/** Deterministic layout: department clusters on a ring, related resources pulled together by short springs. */
export function galaxyLayout(snapshot: Snapshot, ids: Set<string>) {
  const groups = snapshot.departments.map(d => ({ d, items: snapshot.resources.filter(r => r.departmentId === d.id && ids.has(r.id)) })).filter(g => g.items.length);
  const total = groups.reduce((n, g) => n + g.items.length, 0) || 1;
  const pos = new Map<string, Vector3>(), centers = new Map<string, Vector3>();
  let angle = 0;
  const random = seeded(42);
  for (const [i, g] of groups.entries()) {
    const share = g.items.length / total, a = angle + share * Math.PI; angle += share * Math.PI * 2;
    const radius = 500, center = new Vector3(Math.cos(a) * radius, Math.sin(a) * radius, (i % 2 ? 1 : -1) * 50);
    centers.set(g.d.id, center);
    const spread = 40 + Math.sqrt(g.items.length) * 9;
    for (const r of g.items) { const u = random() * 2 - 1, t = random() * Math.PI * 2, s = Math.cbrt(random()) * spread; pos.set(r.id, new Vector3(center.x + Math.sqrt(1 - u * u) * Math.cos(t) * s, center.y + Math.sqrt(1 - u * u) * Math.sin(t) * s, center.z + u * s)); }
  }
  const edges = snapshot.relations.filter(e => pos.has(e.from) && pos.has(e.to));
  const dept = new Map(snapshot.resources.map(r => [r.id, r.departmentId]));
  const byGroup = groups.map(g => g.items.map(r => r.id));
  const tmp = new Vector3();
  for (let step = 0; step < 140; step++) {
    const cool = 1 - step / 140;
    for (const list of byGroup) for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = pos.get(list[i])!, b = pos.get(list[j])!; tmp.subVectors(a, b); const d2 = tmp.lengthSq() + .01;
      if (d2 > 2500) continue; tmp.multiplyScalar(Math.min(4, 180 / d2) * cool); a.add(tmp); b.sub(tmp);
    }
    for (const e of edges) { const a = pos.get(e.from)!, b = pos.get(e.to)!; tmp.subVectors(b, a); const d = tmp.length() || 1; tmp.multiplyScalar((d - 30) / d * .12 * (dept.get(e.from) === dept.get(e.to) ? 1 : .35)); a.add(tmp); b.sub(tmp); }
    for (const [id, p] of pos) { const c = centers.get(dept.get(id)!)!; tmp.subVectors(c, p).multiplyScalar(.018); p.add(tmp); }
  }
  return { pos, centers, edges, groups };
}

export default function NetworkView(p: Props) {
  const root = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null), tip = useRef<HTMLDivElement>(null), latest = useRef(p); latest.current = p;
  const runtime = useRef<{ paint(): void } | null>(null);
  const ids = useMemo(() => new Set(filteredResources(p.snapshot, { ...p.filters, q: '' }).map(r => r.id)), [p.snapshot, p.filters]);
  const layout = useMemo(() => galaxyLayout(p.snapshot, ids), [p.snapshot, ids]);
  useEffect(() => {
    const node = canvas.current, container = root.current; if (!node || !container) return;
    let renderer: WebGLRenderer;
    try { renderer = new WebGLRenderer({ canvas: node, antialias: true, alpha: true, preserveDrawingBuffer: true }); } catch { latest.current.onFailure(); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setClearColor(0, 0);
    const scene = new Scene(); scene.fog = new Fog('#070b26', 2200, 4600);
    const camera = new PerspectiveCamera(45, 1, 1, 8000); camera.position.set(80, -1650, 1400); camera.up.set(0, 0, 1);
    const controls = new OrbitControls(camera, node); controls.enableDamping = !p.reducedMotion; controls.autoRotate = !p.reducedMotion; controls.autoRotateSpeed = .35; controls.minDistance = 120; controls.maxDistance = 3200;
    scene.add(new AmbientLight(0xffffff, 1));
    const resources = p.snapshot.resources.filter(r => layout.pos.has(r.id)), index = new Map(resources.map((r, i) => [r.id, i]));
    const sphere = new SphereGeometry(1, 14, 10), mesh = new InstancedMesh(sphere, new MeshBasicMaterial({ toneMapped: false }), resources.length);
    const m = new Matrix4(), size = { researcher: 4.2, lab: 5.4, equipment: 4.6, space: 6 } as const;
    resources.forEach((r, i) => { const v = layout.pos.get(r.id)!; m.makeScale(size[r.kind], size[r.kind], size[r.kind]).setPosition(v); mesh.setMatrixAt(i, m); mesh.setColorAt(i, new Color(glow[r.kind])); });
    scene.add(mesh);
    const glowGeo = new BufferGeometry(), glowPos = new Float32Array(resources.length * 3), glowCol = new Float32Array(resources.length * 3);
    resources.forEach((r, i) => { const v = layout.pos.get(r.id)!; glowPos.set([v.x, v.y, v.z], i * 3); const c = new Color(glow[r.kind]); glowCol.set([c.r, c.g, c.b], i * 3); });
    glowGeo.setAttribute('position', new BufferAttribute(glowPos, 3)); glowGeo.setAttribute('color', new BufferAttribute(glowCol, 3));
    const halos = new Points(glowGeo, new PointsMaterial({ size: 40, map: dotTexture(), vertexColors: true, transparent: true, opacity: .8, depthWrite: false, blending: AdditiveBlending }));
    scene.add(halos);
    const edgeGeo = new BufferGeometry(), ePos = new Float32Array(layout.edges.length * 6), eCol = new Float32Array(layout.edges.length * 6);
    const kindOf = new Map(p.snapshot.resources.map(r => [r.id, r.kind]));
    layout.edges.forEach((e, i) => { const a = layout.pos.get(e.from)!, b = layout.pos.get(e.to)!; ePos.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6); const ca = new Color(glow[kindOf.get(e.from)!]), cb = new Color(glow[kindOf.get(e.to)!]); eCol.set([ca.r, ca.g, ca.b, cb.r, cb.g, cb.b], i * 6); });
    edgeGeo.setAttribute('position', new BufferAttribute(ePos, 3)); edgeGeo.setAttribute('color', new BufferAttribute(eCol, 3));
    const edges = new LineSegments(edgeGeo, new LineBasicMaterial({ vertexColors: true, transparent: true, opacity: .75, blending: AdditiveBlending, depthWrite: false }));
    scene.add(edges);
    const evidencePairs: [Vector3, Vector3][] = [];
    for (const doc of p.snapshot.evidence) { const placed = doc.resourceIds.filter(id => layout.pos.has(id)); for (let i = 1; i < placed.length; i++) evidencePairs.push([layout.pos.get(placed[0])!, layout.pos.get(placed[i])!]); }
    const evGeo = new BufferGeometry().setFromPoints(evidencePairs.flat());
    const evidence = new LineSegments(evGeo, new LineBasicMaterial({ color: evidenceGlow, transparent: true, opacity: .9, blending: AdditiveBlending, depthWrite: false })); scene.add(evidence);
    const sparkGeo = new BufferGeometry(), sparkPos = new Float32Array(layout.edges.length * 3); sparkGeo.setAttribute('position', new BufferAttribute(sparkPos, 3).setUsage(DynamicDrawUsage));
    const sparks = new Points(sparkGeo, new PointsMaterial({ size: 9, map: dotTexture(), color: '#ffffff', transparent: true, opacity: .95, depthWrite: false, blending: AdditiveBlending })); scene.add(sparks);
    const offsets = layout.edges.map((_, i) => (i * .618) % 1);
    const spokes = new LineSegments(new BufferGeometry().setFromPoints([...layout.centers.values()].flatMap(c => [new Vector3(0, 0, 0), c])), new LineBasicMaterial({ color: '#7f9bff', transparent: true, opacity: .16, blending: AdditiveBlending, depthWrite: false }));
    const coreGeo = new BufferGeometry().setFromPoints([new Vector3()]);
    const core = new Points(coreGeo, new PointsMaterial({ size: 240, map: dotTexture(), color: '#8ea2ff', transparent: true, opacity: .9, depthWrite: false, blending: AdditiveBlending }));
    scene.add(spokes, core);

    const paint = () => {
      const q = latest.current, sel = q.selected && index.has(q.selected) ? q.selected : undefined;
      const near = new Set<string>(sel ? [sel] : []);
      if (sel) for (const e of p.snapshot.relations) { if (e.from === sel) near.add(e.to); if (e.to === sel) near.add(e.from); }
      resources.forEach((r, i) => {
        const on = sel ? near.has(r.id) : q.searching ? q.highlighted.has(r.id) : true;
        const c = new Color(glow[r.kind]); if (!on) c.multiplyScalar(.16); if (r.id === sel) c.set('#ffffff');
        mesh.setColorAt(i, c); glowCol.set([c.r, c.g, c.b], i * 3);
        const v = layout.pos.get(r.id)!, s = size[r.kind] * (r.id === sel ? 2.2 : near.has(r.id) && sel ? 1.5 : q.searching && q.highlighted.has(r.id) ? 1.4 : 1);
        m.makeScale(s, s, s).setPosition(v); mesh.setMatrixAt(i, m);
      });
      mesh.instanceColor!.needsUpdate = true; mesh.instanceMatrix.needsUpdate = true; (glowGeo.getAttribute('color') as BufferAttribute).needsUpdate = true;
      (edges.material as LineBasicMaterial).opacity = sel || q.searching ? .3 : .75;
      controls.autoRotate = !q.reducedMotion && !sel;
    };
    const labels = () => {
      const q = latest.current;
      const placed: [number, number, number, number][] = [];
      const selDept = q.selected ? q.snapshot.resources.find(r => r.id === q.selected)?.departmentId : undefined;
      const all = [...container.querySelectorAll<HTMLElement>('.galaxy-label')].sort((a, b) => Number(Boolean(b.dataset.node)) - Number(Boolean(a.dataset.node)) || Number(b.dataset.count ?? 0) - Number(a.dataset.count ?? 0));
      for (const el of all) {
        const node = el.dataset.node, c = node ? layout.pos.get(node) : el.dataset.dept === '__core' ? new Vector3(0, 0, -70) : layout.centers.get(el.dataset.dept!);
        if (!c || (!node && selDept && el.dataset.dept !== selDept)) { el.style.display = 'none'; continue; }
        const v = (node ? c.clone().add(new Vector3(0, 0, 14)) : c.clone().add(new Vector3(0, 0, 70 + Math.sqrt(Number(el.dataset.count)) * 9))).project(camera);
        if (v.z > 1) { el.style.display = 'none'; continue; }
        const x = (v.x + 1) / 2 * q.width, y = (1 - v.y) / 2 * q.height, w = node ? 110 : Math.max(76, (el.querySelector('strong')?.textContent?.length ?? 6) * 12 + 14), h = node ? 20 : 32;
        if (placed.some(([px, py, pw, ph]) => Math.abs(px - x) * 2 < pw + w && Math.abs(py - y) * 2 < ph + h)) { el.style.display = 'none'; continue; }
        placed.push([x, y, w, h]);
        el.style.display = 'flex'; el.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%)`;
      }
    };
    let flight: { from: Vector3; to: Vector3; fromCam: Vector3; toCam: Vector3; start: number; duration: number } | undefined;
    const flyTo = (target: Vector3, distance: number) => {
      const dir = camera.position.clone().sub(controls.target).normalize(), toCam = target.clone().add(dir.multiplyScalar(distance));
      if (latest.current.reducedMotion) { controls.target.copy(target); camera.position.copy(toCam); return; }
      flight = { from: controls.target.clone(), to: target, fromCam: camera.position.clone(), toCam, start: performance.now(), duration: 1200 };
    };
    const handle: NetworkHandle = {
      home: () => flyTo(new Vector3(), 1950),
      zoom: f => { camera.position.sub(controls.target).divideScalar(f).add(controls.target); },
      focus: id => { const v = layout.pos.get(id); if (v) flyTo(v.clone(), 260); },
    };
    runtime.current = { paint }; paint(); latest.current.onReady(handle);
    if (latest.current.selected) handle.focus(latest.current.selected);
    else if (!latest.current.reducedMotion) { camera.position.set(0, -2900, 2300); flight = { from: new Vector3(), to: new Vector3(), fromCam: camera.position.clone(), toCam: new Vector3(80, -1650, 1400), start: performance.now(), duration: 2600 }; }
    const ray = new Raycaster(), pointer = new Vector2(); let down = [0, 0], hovered: number | undefined;
    const pick = (e: PointerEvent) => { const r = node.getBoundingClientRect(); pointer.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(pointer, camera); return ray.intersectObject(mesh)[0]?.instanceId; };
    const onDown = (e: PointerEvent) => { down = [e.clientX, e.clientY]; flight = undefined; };
    const onUp = (e: PointerEvent) => { if (Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return; const i = pick(e); if (i !== undefined) latest.current.onResource(resources[i].id); };
    const onMove = (e: PointerEvent) => {
      if (e.buttons) return; const i = pick(e), el = tip.current; hovered = i; node.style.cursor = i === undefined ? 'grab' : 'pointer'; if (!el) return;
      if (i === undefined) { el.style.opacity = '0'; return; }
      const r = resources[i], dept = latest.current.snapshot.departments.find(d => d.id === r.departmentId)?.name ?? '';
      const links = latest.current.snapshot.relations.filter(e2 => e2.from === r.id || e2.to === r.id).length;
      el.replaceChildren(); const k = document.createElement('small'); k.textContent = `${kindLabels[r.kind]} · ${dept}`; k.style.color = glow[r.kind];
      const n = document.createElement('strong'); n.textContent = r.name; const l = document.createElement('span'); l.textContent = links ? `공식 연결 ${links}개 · 눌러서 상세 보기` : '공식 연결 없음 · 눌러서 상세 보기';
      el.append(k, n, l); const rect = node.getBoundingClientRect(); el.style.opacity = '1'; el.style.transform = `translate(${e.clientX - rect.left + 14}px,${e.clientY - rect.top + 12}px)`;
    };
    const onLeave = () => { hovered = undefined; if (tip.current) tip.current.style.opacity = '0'; };
    node.addEventListener('pointerdown', onDown); node.addEventListener('pointerup', onUp); node.addEventListener('pointermove', onMove); node.addEventListener('pointerleave', onLeave);
    const onLoss = (e: Event) => { e.preventDefault(); latest.current.onFailure(); }; node.addEventListener('webglcontextlost', onLoss);
    let frame = 0, disposed = false, last = 0;
    const animate = (time: number) => {
      if (disposed) return; frame = requestAnimationFrame(animate); if (document.hidden) return;
      const q = latest.current; renderer.setSize(q.width, q.height, false); camera.aspect = q.width / Math.max(1, q.height); camera.updateProjectionMatrix();
      if (flight) { const k = Math.min(1, (time - flight.start) / flight.duration), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; controls.target.lerpVectors(flight.from, flight.to, e); camera.position.lerpVectors(flight.fromCam, flight.toCam, e); if (k >= 1) flight = undefined; }
      const t = q.reducedMotion ? 0 : time / 1000;
      layout.edges.forEach((edge, i) => { const a = layout.pos.get(edge.from)!, b = layout.pos.get(edge.to)!, f = (t * .45 + offsets[i]) % 1; sparkPos[i * 3] = a.x + (b.x - a.x) * f; sparkPos[i * 3 + 1] = a.y + (b.y - a.y) * f; sparkPos[i * 3 + 2] = a.z + (b.z - a.z) * f; });
      sparkGeo.getAttribute('position').needsUpdate = true;
      (halos.material as PointsMaterial).size = 38 + Math.sin(t * 2) * 5;
      controls.update(); renderer.render(scene, camera); if (time - last > 60) { labels(); last = time; }
      void hovered;
    };
    frame = requestAnimationFrame(animate);
    return () => {
      disposed = true; runtime.current = null; cancelAnimationFrame(frame); controls.dispose();
      node.removeEventListener('pointerdown', onDown); node.removeEventListener('pointerup', onUp); node.removeEventListener('pointermove', onMove); node.removeEventListener('pointerleave', onLeave); node.removeEventListener('webglcontextlost', onLoss);
      for (const o of [mesh, halos, edges, evidence, sparks, spokes, core]) { o.geometry.dispose(); (o.material as { dispose(): void }).dispose(); }
      renderer.dispose();
    };
  }, [layout]);
  useEffect(() => { runtime.current?.paint(); }, [p.selected, p.highlighted, p.searching]);
  const counts = useMemo(() => new Map(layout.groups.map(g => [g.d.id, g.items.length])), [layout]);
  const links = useMemo(() => { const m = new Map<string, number>(); for (const e of layout.edges) { const d = p.snapshot.resources.find(r => r.id === e.from)?.departmentId; if (d) m.set(d, (m.get(d) ?? 0) + 1); } return m; }, [layout, p.snapshot]);
  const nearIds = useMemo(() => p.selected ? [p.selected, ...layout.edges.filter(e => e.from === p.selected || e.to === p.selected).map(e => e.from === p.selected ? e.to : e.from)].filter((id, i, a) => a.indexOf(id) === i).slice(0, 13) : [], [p.selected, layout]);
  return <div ref={root} className="galaxy" style={{ position: 'relative', width: p.width, height: p.height }}>
    <canvas ref={canvas} style={{ width: '100%', height: '100%', touchAction: 'none' }} tabIndex={0} aria-label={`연결망 보기. 자원 ${layout.pos.size}개와 공식 관계 ${layout.edges.length}개를 학과·기관별로 묶어 표시합니다. 드래그 회전, 휠 확대. 자원 목록에서도 선택할 수 있습니다.`} />
    <div className="campus-hover galaxy-tip" ref={tip} aria-hidden="true" />
    <div className="campus-label-layer"><span className="galaxy-label galaxy-core" data-dept="__core" data-count="0"><strong>서울공대</strong><small>자원 {layout.pos.size} · 공식 연결 {layout.edges.length}</small></span>{layout.groups.map(g => <span key={g.d.id} className="galaxy-label" data-dept={g.d.id} data-count={counts.get(g.d.id)}><strong>{g.d.name}</strong><small>자원 {counts.get(g.d.id)} · 연결 {links.get(g.d.id) ?? 0}</small></span>)}{nearIds.map(id => { const r = p.snapshot.resources.find(x => x.id === id); return r ? <span key={`n-${id}`} className={`galaxy-label galaxy-node ${id === p.selected ? 'is-center' : ''}`} data-node={id} style={{ display: 'none' }}>{r.name.length > 16 ? `${r.name.slice(0, 15)}…` : r.name}</span> : null; })}</div>
  </div>;
}

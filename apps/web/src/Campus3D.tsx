import { useEffect, useRef } from 'react';
import {
  AdditiveBlending, AmbientLight, BufferAttribute, BufferGeometry, CanvasTexture, Color, CylinderGeometry, DirectionalLight, DoubleSide,
  EdgesGeometry, ExtrudeGeometry, Fog, Group, HemisphereLight, Line, LineBasicMaterial, LineDashedMaterial, LineSegments, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, Object3D, Path, PerspectiveCamera, PlaneGeometry, QuadraticBezierCurve3, Raycaster, RingGeometry,
  Scene, ShaderMaterial, Shape, SphereGeometry, Sprite, SpriteMaterial, TubeGeometry, Vector2, Vector3, WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { homeView, project, surface, pickLabels, type CampusViewProps, type Viewpoint } from './campus-model';
import { evidenceGlow, glow, kindOrder, type Ego, type Kind, type NetworkModel } from './network';
import { kindLabels } from './Detail';

const SKY = '#070b26';
const FOG_NEAR = 5200, FOG_FAR = 14000;
const UNIT = 4.2; // metres of column per located resource

const terrainVertex = `varying float vH;varying vec3 vN;varying vec2 vXY;varying float vDepth;
void main(){vH=position.z;vN=normal;vXY=position.xy;vec4 mv=modelViewMatrix*vec4(position,1.);vDepth=-mv.z;gl_Position=projectionMatrix*mv;}`;
const terrainFragment = `uniform vec3 uLow;uniform vec3 uHigh;uniform vec3 uLine;uniform vec3 uFog;uniform float uNear;uniform float uFar;
varying float vH;varying vec3 vN;varying vec2 vXY;varying float vDepth;
float band(float v,float k){float w=fwidth(v)*k;return 1.-smoothstep(0.,w,abs(fract(v-.5)-.5));}
void main(){
 vec3 base=mix(uLow,uHigh,smoothstep(30.,520.,vH));
 float light=.5+.7*max(dot(normalize(vN),normalize(vec3(-.45,.5,.8))),0.);
 vec3 col=base*light;
 col+=uLine*(band(vH/10.,1.1)*.09+band(vH/50.,1.5)*.24);
 vec2 g=vXY/200.;col+=uLine*max(band(g.x,1.),band(g.y,1.))*.035;
 col=mix(col,uFog,smoothstep(uNear,uFar,vDepth));
 gl_FragColor=vec4(col,1.);
}`;
const flowVertex = `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const flowFragment = `uniform vec3 uA;uniform vec3 uB;uniform float uTime;uniform float uOpacity;uniform float uSpeed;uniform float uDash;varying vec2 vUv;
void main(){vec3 c=mix(uA,uB,vUv.x);float p=fract(vUv.x*uDash-uTime*uSpeed);float pulse=smoothstep(0.,.12,p)*(1.-smoothstep(.12,.42,p));
gl_FragColor=vec4(c*(1.+pulse*.9),uOpacity*(.3+.95*pulse));}`;

let haloTexture: CanvasTexture | undefined;
function halo() {
  if (haloTexture) return haloTexture;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!, g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.18, 'rgba(255,255,255,.55)'); g.addColorStop(.5, 'rgba(255,255,255,.12)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  return haloTexture = new CanvasTexture(canvas);
}
export const departmentColor = (id: string) => { let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360; return new Color().setHSL(h / 360, .7, .62); };
const ease = (t: number) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

type Flow = ShaderMaterial & { uniforms: { uTime: { value: number }; uOpacity: { value: number } } };
function flowMaterial(a: Color | string, b: Color | string, opacity: number, speed = .35, dash = 2.2): Flow {
  return new ShaderMaterial({
    vertexShader: flowVertex, fragmentShader: flowFragment, transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide,
    uniforms: { uA: { value: new Color(a) }, uB: { value: new Color(b) }, uTime: { value: 0 }, uOpacity: { value: opacity }, uSpeed: { value: speed }, uDash: { value: dash } },
  }) as Flow;
}
function arc(from: Vector3, to: Vector3, lift: number) {
  const mid = from.clone().add(to).multiplyScalar(.5); mid.z = Math.max(from.z, to.z) + lift;
  return new QuadraticBezierCurve3(from, mid, to);
}
function dispose(group: Group) {
  group.traverse(o => {
    if (o instanceof Mesh || o instanceof LineSegments || o instanceof Line || o instanceof Sprite) {
      o.geometry?.dispose();
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
    }
  });
  group.clear();
}

type EgoPoint = { id: string; kind: Kind; position: Vector3; ring: 0 | 1 | 2 | 3; name: string; relation: string; buildingId?: string };
export const egoLimits = { 1: 12, 2: 10, 3: 6 } as const;
function egoLayout(ego: Ego, anchor: Vector3) {
  const points: EgoPoint[] = [{ id: ego.center.id, kind: ego.center.kind, position: anchor.clone(), ring: 0, name: ego.center.name, relation: kindLabels[ego.center.kind], buildingId: ego.buildingId }];
  const rings: Record<1 | 2 | 3, { radius: number; drop: number }> = { 1: { radius: 130, drop: 30 }, 2: { radius: 225, drop: 70 }, 3: { radius: 175, drop: 125 } };
  for (const ring of [1, 2, 3] as const) {
    const list = ego.nodes.filter(n => n.ring === ring).slice(0, egoLimits[ring]);
    const radius = Math.max(rings[ring].radius, list.length * (ring === 3 ? 30 : 24));
    list.forEach((n, i) => {
      const angle = (i / Math.max(1, list.length)) * Math.PI * 2 + ring * .7;
      points.push({ id: n.resource.id, kind: n.resource.kind, ring, name: n.resource.name, relation: n.relation, buildingId: n.buildingId,
        position: new Vector3(anchor.x + Math.cos(angle) * radius, anchor.y + Math.sin(angle) * radius, anchor.z - rings[ring].drop) });
    });
  }
  return points;
}

export default function Campus3D(p: CampusViewProps) {
  const root = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null), tooltip = useRef<HTMLDivElement>(null), latest = useRef(p); latest.current = p;
  const runtime = useRef<{ apply(v: Viewpoint): void; update(): void; rebuild(): void } | null>(null);
  useEffect(() => {
    const node = canvas.current, container = root.current; if (!node || !container) return;
    let renderer: WebGLRenderer;
    try { renderer = new WebGLRenderer({ canvas: node, antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: true }); } catch { latest.current.onFailure(); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setClearColor(0x000000, 0);
    const scene = new Scene(), camera = new PerspectiveCamera(40, 1, 1, 20000); camera.up.set(0, 0, 1);
    scene.fog = new Fog(SKY, FOG_NEAR, FOG_FAR);
    const controls = new OrbitControls(camera, node); controls.enableDamping = !p.reducedMotion; controls.dampingFactor = .1; controls.minDistance = 160; controls.maxDistance = 12500; controls.maxPolarAngle = Math.PI * .46; controls.minPolarAngle = Math.PI * .06;
    const light = new DirectionalLight(0xdfe6ff, 1.25); light.position.set(-900, 1400, 2600);
    scene.add(new AmbientLight(0x8a9cff, .35), new HemisphereLight(0x9fb2ff, 0x060a1f, .9), light);
    const meshes = new Map<string, Mesh>(), roofs = new Map<string, number>(), base = new Group(), dynamic = new Group(), egoGroup = new Group();
    scene.add(base, dynamic, egoGroup);
    const c = p.campus, t = c.terrain;
    if (t) {
      const positions: number[] = [], indices: number[] = [];
      for (let j = 0; j < t.rows; j++) for (let i = 0; i < t.columns; i++) {
        const [x, y] = project([t.west + (i + .5) / t.columns * (t.east - t.west), t.north - (j + .5) / t.rows * (t.north - t.south)]);
        positions.push(x, y, t.heights[j * t.columns + i] ?? 0);
      }
      for (let j = 0; j < t.rows - 1; j++) for (let i = 0; i < t.columns - 1; i++) {
        const a = j * t.columns + i, b = a + 1, cc = a + t.columns, d = cc + 1;
        if ([a, b, cc, d].every(n => t.heights[n] !== null)) indices.push(a, cc, b, b, cc, d);
      }
      const geometry = new BufferGeometry(); geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
      base.add(new Mesh(geometry, new ShaderMaterial({ vertexShader: terrainVertex, fragmentShader: terrainFragment, side: DoubleSide,
        uniforms: { uLow: { value: new Color('#1a2566') }, uHigh: { value: new Color('#2e3c85') }, uLine: { value: new Color('#7f9bff') }, uFog: { value: new Color(SKY) }, uNear: { value: FOG_NEAR }, uFar: { value: FOG_FAR } } })));
    } else base.add(new Mesh(new PlaneGeometry(2600, 3300), new MeshStandardMaterial({ color: '#141c4a', side: DoubleSide })));
    for (const kind of ['road', 'footway', 'green'] as const) {
      const positions: number[] = [];
      for (const path of c.paths.filter(r => r.kind === kind)) for (let i = 1; i < path.points.length; i++) for (const point of [path.points[i - 1], path.points[i]]) {
        const [x, y] = project(point); positions.push(x, y, surface(c, x, y) + 2.5);
      }
      const geometry = new BufferGeometry(); geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
      base.add(new LineSegments(geometry, new LineBasicMaterial({ color: kind === 'road' ? '#8fa6ff' : kind === 'green' ? '#3fbf8f' : '#5868b0', transparent: true, opacity: kind === 'road' ? .55 : kind === 'green' ? .35 : .3 })));
    }
    for (const m of p.model.markers) {
      const b = m.building, height = b.heightMeters ?? 12, ground = surface(c, ...m.center); let geometry: ExtrudeGeometry | PlaneGeometry;
      if (b.footprint) {
        const ring = b.footprint.coordinates[0].map(project), shape = new Shape(ring.map(([x, y]) => new Vector2(x, y)));
        for (const hole of b.footprint.coordinates.slice(1)) shape.holes.push(new Path(hole.map(pt => { const [x, y] = project(pt); return new Vector2(x, y); })));
        geometry = new ExtrudeGeometry(shape, { depth: height, bevelEnabled: false }); geometry.translate(0, 0, ground);
        base.add(new LineSegments(new EdgesGeometry(geometry, 25), new LineBasicMaterial({ color: '#7d93ff', transparent: true, opacity: .32 })));
      } else { geometry = new PlaneGeometry(14, 14); geometry.translate(m.center[0], m.center[1], ground + 2); }
      roofs.set(b.id, ground + (b.footprint ? height : 2));
      const mesh = new Mesh(geometry, new MeshStandardMaterial({ color: '#1b2453', emissive: '#000000', roughness: .55, metalness: .15, side: DoubleSide }));
      mesh.userData.buildingId = b.id; meshes.set(b.id, mesh); base.add(mesh);
    }
    const centerOf = (id: string) => latest.current.model.markers.find(m => m.building.id === id)?.center;
    const top = (id: string, stack = 0) => { const ce = centerOf(id); return ce ? new Vector3(ce[0], ce[1], (roofs.get(id) ?? 0) + stack) : undefined; };
    let flows: Flow[] = [], egoPoints: EgoPoint[] = [], egoAnchor: Vector3 | undefined, pulseRings: Mesh[] = [];
    const stackHeight = (network: NetworkModel | undefined, id: string) => (network?.stacks.find(s => s.buildingId === id)?.total ?? 0) * UNIT;
    let hovered: string | undefined;

    const paint = () => {
      const q = latest.current, network = q.network;
      const egoBuildings = new Map<string, Kind>();
      if (q.ego) { for (const n of q.ego.nodes) if (n.buildingId && n.ring < 3 && !egoBuildings.has(n.buildingId)) egoBuildings.set(n.buildingId, n.resource.kind); if (q.ego.buildingId) egoBuildings.set(q.ego.buildingId, q.ego.center.kind); }
      const stacked = new Set(network?.stacks.map(s => s.buildingId));
      for (const m of q.model.markers) {
        const material = meshes.get(m.building.id)?.material as MeshStandardMaterial | undefined; if (!material) continue;
        const id = m.building.id, selected = id === q.selectedBuilding, hit = q.searching && m.matched > 0, college = q.college && m.building.collegeIds.includes(q.college), ego = egoBuildings.get(id);
        const [color, emissive, intensity] = selected ? ['#3c50d8', '#8ea2ff', .95] : ego ? ['#232f6b', glow[ego], .55] : hit ? ['#4d3a12', '#ffb547', .75] : q.searching ? ['#141a3d', '#000000', 0]
          : college ? ['#1a4766', '#38b6e0', .4] : stacked.has(id) || m.resourceIds.length ? ['#33449a', '#3d5cf0', .45] : ['#2a356f', '#141f66', .25];
        material.color.set(color); material.emissive.set(emissive); material.emissiveIntensity = (intensity as number) + (id === hovered ? .35 : 0);
      }
    };

    const rebuild = () => {
      dispose(dynamic); dispose(egoGroup); flows = []; pulseRings = [];
      const q = latest.current, network = q.network, layers = q.layers ?? new Set(['official', 'evidence', 'department']);
      if (network) {
        for (const stack of network.stacks) {
          const start = top(stack.buildingId); if (!start) continue;
          let z = start.z + 1.5;
          for (const kind of kindOrder) {
            const n = stack.counts[kind]; if (!n) continue;
            const h = n * UNIT, geometry = new CylinderGeometry(12, 12, Math.max(1, h - .8), 24); geometry.rotateX(Math.PI / 2); geometry.translate(start.x, start.y, z + h / 2);
            const column = new Mesh(geometry, new MeshBasicMaterial({ color: glow[kind], transparent: true, opacity: .92, fog: false }));
            column.userData.buildingId = stack.buildingId; dynamic.add(column); z += h;
          }
          const beacon = new Sprite(new SpriteMaterial({ map: halo(), color: '#9fb6ff', blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: .85, fog: false }));
          beacon.position.set(start.x, start.y, z + 6); beacon.scale.set(70, 70, 1); dynamic.add(beacon);
          if (stack.internalRelations > 0) {
            const ring = new Mesh(new RingGeometry(30, 34, 48), new MeshBasicMaterial({ color: '#b69cff', transparent: true, opacity: .55, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }));
            ring.position.set(start.x, start.y, start.z + 2); ring.userData.base = .55; pulseRings.push(ring); dynamic.add(ring);
          }
        }
        const egoBuildings = new Set(q.ego ? [q.ego.buildingId, ...q.ego.nodes.map(n => n.buildingId)].filter(Boolean) as string[] : []);
        for (const link of network.links) {
          if (!layers.has(link.layer)) continue;
          const a = top(link.from, stackHeight(network, link.from)), b = top(link.to, stackHeight(network, link.to)); if (!a || !b) continue;
          const focused = !q.ego || (egoBuildings.has(link.from) && egoBuildings.has(link.to));
          const curve = arc(a, b, 60 + a.distanceTo(b) * (link.layer === 'department' ? .22 : .38));
          const radius = link.layer === 'department' ? 1.6 : Math.min(5.5, 2.4 + link.weight * .6);
          const dept = departmentColor(link.departmentId ?? link.id);
          const material = link.layer === 'official' ? flowMaterial(glow[link.fromKind ?? 'researcher'], glow[link.toKind ?? 'lab'], focused ? 1 : .25, .32, 2.4)
            : link.layer === 'evidence' ? flowMaterial(evidenceGlow, '#fff6d8', focused ? 1 : .25, .22, 3)
            : flowMaterial(dept, dept.clone().offsetHSL(0, 0, .15), focused ? .5 : .14, .18, 1.6);
          flows.push(material); dynamic.add(new Mesh(new TubeGeometry(curve, 64, radius, 8, false), material));
        }
      }
      egoPoints = []; egoAnchor = undefined;
      if (q.ego) {
        const ego = q.ego, home = ego.buildingId ?? ego.nodes.find(n => n.buildingId && n.ring < 3)?.buildingId ?? q.network?.hubs.get(ego.center.departmentId);
        const anchorBase = home ? top(home, stackHeight(network, home)) : undefined;
        egoAnchor = anchorBase ? anchorBase.clone().add(new Vector3(0, 0, 150)) : new Vector3(q.viewpoint.x, q.viewpoint.y, surface(q.campus, q.viewpoint.x, q.viewpoint.y) + 260);
        egoPoints = egoLayout(ego, egoAnchor);
        const byId = new Map(egoPoints.map(pt => [pt.id, pt]));
        for (const pt of egoPoints) {
          const size = pt.ring === 0 ? 17 : pt.ring === 3 ? 7 : 11;
          const sphere = new Mesh(new SphereGeometry(size, 24, 16), new MeshBasicMaterial({ color: glow[pt.kind], transparent: pt.ring === 3, opacity: pt.ring === 3 ? .55 : 1, fog: false }));
          sphere.position.copy(pt.position); sphere.userData.resourceId = pt.id; egoGroup.add(sphere);
          const aura = new Sprite(new SpriteMaterial({ map: halo(), color: glow[pt.kind], blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: pt.ring === 3 ? .35 : .9, fog: false }));
          aura.position.copy(pt.position); aura.scale.setScalar(size * (pt.ring === 0 ? 9 : 6)); egoGroup.add(aura);
          if (pt.ring === 1 || pt.ring === 2) {
            const parentId = pt.ring === 2 ? ego.nodes.find(n => n.resource.id === pt.id)?.via : undefined;
            const parent = (parentId && byId.get(parentId)) || egoPoints[0];
            const material = flowMaterial(glow[parent.kind], pt.relation.includes('논문') ? evidenceGlow : glow[pt.kind], 1, .55, 1.8); flows.push(material);
            egoGroup.add(new Mesh(new TubeGeometry(arc(parent.position, pt.position, 26), 40, pt.ring === 1 ? 3.2 : 2.2, 8, false), material));
          } else if (pt.ring === 3) {
            const line = new Line(new BufferGeometry().setFromPoints([egoPoints[0].position, pt.position]), new LineDashedMaterial({ color: '#c5cff5', dashSize: 8, gapSize: 8, transparent: true, opacity: .45, fog: false }));
            line.computeLineDistances(); egoGroup.add(line);
          }
          const roof = pt.buildingId ? top(pt.buildingId, stackHeight(network, pt.buildingId)) : undefined;
          if (roof) {
            const tether = new Line(new BufferGeometry().setFromPoints([pt.position, roof]), new LineDashedMaterial({ color: glow[pt.kind], dashSize: 6, gapSize: 5, transparent: true, opacity: pt.ring === 3 ? .3 : .75, fog: false }));
            tether.computeLineDistances(); egoGroup.add(tether);
            const foot = new Mesh(new RingGeometry(12, 16, 40), new MeshBasicMaterial({ color: glow[pt.kind], transparent: true, opacity: .8, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, fog: false }));
            foot.position.copy(roof).add(new Vector3(0, 0, 1.5)); foot.userData.base = .7; pulseRings.push(foot); egoGroup.add(foot);
          }
        }
      }
      paint();
    };

    let frame = 0, lastLabels = 0, disposed = false;
    const place = (el: HTMLElement, world: Vector3, occupied: { x: number; y: number; w: number; h: number }[], force = false, pad = 6) => {
      const q = latest.current, pos = world.clone().project(camera);
      const x = (pos.x + 1) / 2 * q.width, y = (1 - pos.y) / 2 * q.height, w = el.offsetWidth || 120, h = el.offsetHeight || 26;
      if (pos.z < -1 || pos.z > 1 || x < 5 || x > q.width - 5 || y < 5 || y > q.height - 40) return false;
      if (!force && occupied.some(r => Math.abs(x - r.x) < (w + r.w) / 2 + pad && Math.abs(y - r.y) < (h + r.h) / 2 + pad)) return false;
      occupied.push({ x, y, w, h }); el.style.display = el.classList.contains('ego-label') || el.classList.contains('campus-college-label') ? 'flex' : 'block'; el.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%)`; return true;
    };
    const labels = () => {
      const q = latest.current, occupied: { x: number; y: number; w: number; h: number }[] = [];
      for (const el of container.querySelectorAll<HTMLElement>('.ego-label')) {
        el.style.display = 'none'; const pt = egoPoints.find(e => e.id === el.dataset.ego); if (!pt) continue;
        place(el, pt.position.clone().add(new Vector3(0, 0, pt.ring === 0 ? 36 : 24)), occupied, pt.ring === 0, 2);
      }
      for (const el of container.querySelectorAll<HTMLButtonElement>('.campus-relation-label')) {
        const link = q.model.links.find(l => l.id === el.dataset.relation); el.style.display = 'none'; if (!link || q.ego) continue;
        const a = q.model.markers.find(m => m.building.id === link.from), b = q.model.markers.find(m => m.building.id === link.to); if (!a || !b) continue;
        place(el, new Vector3((a.center[0] + b.center[0]) / 2, (a.center[1] + b.center[1]) / 2, Math.max(surface(q.campus, ...a.center), surface(q.campus, ...b.center)) + 90), occupied);
      }
      for (const el of container.querySelectorAll<HTMLButtonElement>('.campus-college-label')) {
        const college = q.model.colleges.find(cc => cc.id === el.dataset.college); el.style.display = 'none'; if (!college || q.viewpoint.zoom >= 2 || q.selectedBuilding || q.ego) continue;
        place(el, new Vector3(college.center[0], college.center[1], surface(q.campus, ...college.center) + 60), occupied, false, 8);
      }
      const valid = pickLabels(q.model, q.selectedBuilding, q.searching, q.viewpoint.zoom);
      const elements = new Map([...container.querySelectorAll<HTMLButtonElement>('.campus-map-label')].map(el => [el.dataset.building!, el]));
      for (const el of elements.values()) el.style.display = 'none';
      for (const m of valid) {
        const el = elements.get(m.building.id); if (!el) continue;
        if (q.ego && m.building.id !== q.selectedBuilding) continue;
        place(el, new Vector3(m.center[0], m.center[1], (roofs.get(m.building.id) ?? 0) + stackHeight(q.network, m.building.id) + 30), occupied, m.building.id === q.selectedBuilding, 8);
      }
    };
    const apply = (v: Viewpoint) => {
      const ground = surface(latest.current.campus, v.x, v.y), lifted = egoAnchor && Math.hypot(egoAnchor.x - v.x, egoAnchor.y - v.y) < 2 ? egoAnchor.z - 70 : ground;
      const distance = 3800 / v.zoom, pitch = v.pitch * Math.PI / 180, bearing = v.bearing * Math.PI / 180, z = lifted;
      controls.target.set(v.x, v.y, z); camera.position.set(v.x + Math.sin(bearing) * Math.cos(pitch) * distance, v.y + Math.cos(bearing) * Math.cos(pitch) * distance, z + Math.sin(pitch) * distance); camera.lookAt(controls.target); controls.update(); labels();
    };
    const current = (): Viewpoint => { const target = controls.target, diff = camera.position.clone().sub(target), d = diff.length(); return { x: target.x, y: target.y, zoom: 3800 / d, bearing: Math.atan2(diff.x, diff.y) * 180 / Math.PI, pitch: Math.asin(diff.z / d) * 180 / Math.PI }; };
    const commit = () => { const v = current(); latest.current.onViewpoint({ x: Math.max(-6000, Math.min(6000, v.x)), y: Math.max(-6000, Math.min(6000, v.y)), zoom: Math.max(.2, Math.min(20, v.zoom)), bearing: v.bearing, pitch: Math.max(15, Math.min(85, v.pitch)) }); };
    let flight: { from: Viewpoint; to: Viewpoint; start: number; duration: number } | undefined;
    const fly = (to: Viewpoint, duration = 1100) => {
      if (latest.current.reducedMotion) { apply(to); return; }
      const from = current(); const delta = ((to.bearing - from.bearing + 540) % 360) - 180;
      flight = { from, to: { ...to, bearing: from.bearing + delta }, start: performance.now(), duration };
    };
    const update = () => { const q = latest.current; renderer.setSize(q.width, q.height, false); camera.aspect = q.width / Math.max(1, q.height); camera.updateProjectionMatrix(); paint(); labels(); };
    const focusTarget = (id: string): Viewpoint | undefined => {
      const q = latest.current;
      const college = q.model.colleges.find(cc => `college:${cc.id}` === id);
      if (college) return { ...q.viewpoint, x: college.center[0], y: college.center[1], zoom: 1.7 };
      if (q.ego && id === q.ego.center.id && egoAnchor) return { ...q.viewpoint, x: egoAnchor.x, y: egoAnchor.y, zoom: 3.4, pitch: 30 };
      const m = q.model.markers.find(mm => mm.building.id === id || mm.resourceIds.includes(id));
      return m ? { ...q.viewpoint, x: m.center[0], y: m.center[1], zoom: 4 } : undefined;
    };
    const handles = {
      home: () => { fly(homeView, 900); latest.current.onViewpoint(homeView); },
      zoom: (factor: number) => { camera.position.sub(controls.target).divideScalar(factor).add(controls.target); controls.update(); commit(); },
      focus: (id: string) => { const v = focusTarget(id); if (!v) return; fly(v, 1300); latest.current.onViewpoint(v); },
    };
    runtime.current = { apply: v => { if (!flight) apply(v); }, update, rebuild }; rebuild(); update();
    let introPending = true;
    const stacks = p.network?.stacks ?? [], weight = stacks.reduce((n, s) => n + s.total, 0);
    const showcase: Viewpoint = weight ? { x: stacks.reduce((n, s) => n + (centerOf(s.buildingId)?.[0] ?? 0) * s.total, 0) / weight, y: stacks.reduce((n, s) => n + (centerOf(s.buildingId)?.[1] ?? 0) * s.total, 0) / weight, zoom: 2.1, pitch: 46, bearing: -28 } : homeView;
    if (p.viewpoint === homeView && !p.ego && !p.selectedBuilding) {
      if (p.reducedMotion) { apply(showcase); p.onViewpoint(showcase); }
      else { apply({ ...homeView, zoom: .42, pitch: 74, bearing: -48 }); fly(showcase, 3000); setTimeout(() => { if (!disposed && introPending) latest.current.onViewpoint(showcase); }, 3050); }
    }
    else apply(p.viewpoint);
    latest.current.onReady(handles);

    const ray = new Raycaster(), pointer = new Vector2(); let down: [number, number] = [0, 0], lastMove = 0;
    const pick = (e: PointerEvent, objects: Object3D[]) => { const r = node.getBoundingClientRect(); pointer.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(pointer, camera); return ray.intersectObjects(objects, false)[0]; };
    const buildingTargets = () => [...meshes.values(), ...dynamic.children.filter(o => o.userData.buildingId)];
    const onDown = (e: PointerEvent) => { down = [e.clientX, e.clientY]; flight = undefined; introPending = false; };
    const onUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
      const egoHit = pick(e, egoGroup.children.filter(o => o.userData.resourceId));
      if (egoHit && egoHit.object.userData.resourceId !== latest.current.ego?.center.id) { latest.current.onResource?.(egoHit.object.userData.resourceId); return; }
      const first = pick(e, buildingTargets()); if (first) latest.current.onBuilding(first.object.userData.buildingId);
    };
    const onMove = (e: PointerEvent) => {
      const now = performance.now(); if (now - lastMove < 50 || e.buttons) return; lastMove = now;
      const hit = pick(e, buildingTargets()), id = hit?.object.userData.buildingId as string | undefined, tip = tooltip.current;
      if (id !== hovered) { hovered = id; paint(); }
      node.style.cursor = id ? 'pointer' : 'grab';
      if (!tip) return;
      if (!id) { tip.style.opacity = '0'; return; }
      const q = latest.current, b = q.campus.buildings.find(bb => bb.id === id), stack = q.network?.stacks.find(s => s.buildingId === id);
      tip.replaceChildren();
      const title = document.createElement('strong'); title.textContent = `${b?.number ? `${b.number}동 ` : ''}${b?.name ?? ''}`; tip.append(title);
      const row = document.createElement('span'); row.className = 'tip-kinds';
      if (stack) { for (const kind of kindOrder) if (stack.counts[kind]) { const chip = document.createElement('i'); chip.style.setProperty('--k', glow[kind]); chip.textContent = `${kindLabels[kind]} ${stack.counts[kind]}`; row.append(chip); } }
      else row.textContent = '위치 확인된 수록 자원 없음';
      tip.append(row);
      if (stack?.internalRelations) { const rel = document.createElement('small'); rel.textContent = `건물 안 공식 관계 ${stack.internalRelations}건`; tip.append(rel); }
      const r = node.getBoundingClientRect(); tip.style.opacity = '1'; tip.style.transform = `translate(${e.clientX - r.left + 16}px,${e.clientY - r.top + 12}px)`;
    };
    const onLeave = () => { if (tooltip.current) tooltip.current.style.opacity = '0'; if (hovered) { hovered = undefined; paint(); } };
    const onLoss = (e: Event) => { e.preventDefault(); latest.current.onFailure(); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Home') handles.home(); else if (e.key === '+' || e.key === '=') handles.zoom(1.3); else if (e.key === '-') handles.zoom(.77); else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) { e.preventDefault(); const v = { ...latest.current.viewpoint }, step = 80 / v.zoom; v.x += e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0; v.y += e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0; apply(v); latest.current.onViewpoint(v); } };
    node.addEventListener('pointerdown', onDown); node.addEventListener('pointerup', onUp); node.addEventListener('pointermove', onMove); node.addEventListener('pointerleave', onLeave);
    node.addEventListener('webglcontextlost', onLoss); node.addEventListener('keydown', key); controls.addEventListener('end', commit);
    const animate = (time: number) => {
      if (disposed) return; frame = requestAnimationFrame(animate); if (document.hidden) return;
      if (flight) {
        const k = Math.min(1, (time - flight.start) / flight.duration), e = ease(k), f = flight.from, to = flight.to;
        apply({ x: f.x + (to.x - f.x) * e, y: f.y + (to.y - f.y) * e, zoom: Math.exp(Math.log(f.zoom) + (Math.log(to.zoom) - Math.log(f.zoom)) * e), bearing: f.bearing + (to.bearing - f.bearing) * e, pitch: f.pitch + (to.pitch - f.pitch) * e });
        if (k >= 1) flight = undefined;
      }
      const seconds = latest.current.reducedMotion ? 0 : time / 1000, phase = (seconds * .6) % 1;
      for (const material of flows) material.uniforms.uTime.value = seconds;
      for (const ring of pulseRings) { const s = 1 + phase * .9; ring.scale.set(s, s, 1); (ring.material as MeshBasicMaterial).opacity = ring.userData.base * (latest.current.reducedMotion ? 1 : 1 - phase); }
      controls.update(); renderer.render(scene, camera); if (time - lastLabels > 90) { labels(); lastLabels = time; }
    };
    frame = requestAnimationFrame(animate);
    return () => {
      disposed = true; runtime.current = null; cancelAnimationFrame(frame); controls.removeEventListener('end', commit); controls.dispose();
      node.removeEventListener('pointerdown', onDown); node.removeEventListener('pointerup', onUp); node.removeEventListener('pointermove', onMove); node.removeEventListener('pointerleave', onLeave);
      node.removeEventListener('webglcontextlost', onLoss); node.removeEventListener('keydown', key);
      dispose(dynamic); dispose(egoGroup); dispose(base); renderer.dispose();
    };
  }, [p.campus, p.model.markers.length]);
  useEffect(() => { runtime.current?.rebuild(); }, [p.network, p.ego, p.layers]);
  useEffect(() => { runtime.current?.update(); }, [p]);
  useEffect(() => { runtime.current?.apply(p.viewpoint); }, [p.viewpoint]);
  const egoNodes = p.ego ? [{ id: p.ego.center.id, name: p.ego.center.name, kind: p.ego.center.kind, relation: kindLabels[p.ego.center.kind], ring: 0 },
    ...([1, 2, 3] as const).flatMap(ring => p.ego!.nodes.filter(n => n.ring === ring).slice(0, egoLimits[ring])).map(n => ({ id: n.resource.id, name: n.resource.name, kind: n.resource.kind, relation: n.relation, ring: n.ring }))] : [];
  return <div ref={root} className="campus-3d" style={{ position: 'relative', width: p.width, height: p.height }}>
    <canvas ref={canvas} style={{ width: '100%', height: '100%', touchAction: 'none' }} tabIndex={0} aria-label="3D 실제 관악 캠퍼스. 드래그 회전, 휠 확대, 방향키 이동. 건물 목록에서도 선택 가능." />
    <div className="campus-hover" ref={tooltip} aria-hidden="true" />
    <div className="campus-label-layer">
      {p.model.links.map(l => <button key={l.id} className="campus-relation-label" data-relation={l.id} onClick={() => p.onRelation(l.id)}>{l.label}{l.from === l.to ? ' · 같은 건물' : ''} ↗</button>)}
      {(!p.searching ? p.model.colleges : []).map(cc => <button key={cc.id} className={`campus-college-label ${p.college === cc.id ? 'selected' : ''}`} data-college={cc.id} onClick={() => { p.onCollege(cc.id); const v = { ...p.viewpoint, x: cc.center[0], y: cc.center[1], zoom: 1.7 }; runtime.current?.apply(v); p.onViewpoint(v); }}><strong>{cc.name}</strong><small>건물 {cc.buildingIds.length} · 수록 {cc.resourceCount}</small></button>)}
      {p.model.markers.filter(m => m.building.number || m.resourceIds.length || m.building.id === p.selectedBuilding).map(m => <button key={m.building.id} data-building={m.building.id} className={`campus-map-label ${m.building.id === p.selectedBuilding ? 'selected' : ''}`} onClick={() => p.onBuilding(m.building.id)}>{m.building.number ? `${m.building.number}동 ` : ''}{m.building.name}{p.searching ? ` · 검색 ${m.matched}` : m.resourceIds.length ? ` · ${m.resourceIds.length}` : ''}</button>)}
      {egoNodes.map(n => <button key={n.id} data-ego={n.id} className={`ego-label ring-${n.ring}`} style={{ ['--k' as string]: glow[n.kind] }} onClick={() => n.ring !== 0 && p.onResource?.(n.id)} aria-label={`${n.relation}: ${n.name}`}><i aria-hidden="true" /><span><small>{n.relation}</small>{n.name.length > 26 ? `${n.name.slice(0, 25)}…` : n.name}</span></button>)}
    </div>
  </div>;
}

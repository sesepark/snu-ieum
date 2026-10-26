import { useEffect, useMemo, useRef } from 'react';
import ForceGraph3D, { type ForceGraphMethods } from 'react-force-graph-3d';
import { BoxGeometry, CanvasTexture, CylinderGeometry, DoubleSide, Group, Mesh, MeshStandardMaterial, MeshBasicMaterial, OctahedronGeometry, RingGeometry, SphereGeometry, Sprite, SpriteMaterial, AmbientLight, DirectionalLight, PerspectiveCamera, Vector3, type BufferGeometry } from 'three';
import { colors, endpointId, escapeHtml, related, type DisplayNode, type DisplayEdge, type ViewProps } from './map-model';
function label(text: string) {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 100;
  const ctx = canvas.getContext('2d')!; ctx.font = '500 44px sans-serif'; ctx.fillStyle = '#46566d'; ctx.textAlign = 'center';
  const characters = Array.from(text); let visible = text;
  while (ctx.measureText(visible).width > 960 && characters.length) { characters.pop(); visible = characters.join('') + '…'; }
  ctx.fillText(visible, 512, 60);
  const texture = new CanvasTexture(canvas); const sprite = new Sprite(new SpriteMaterial({ map: texture, transparent: true, depthWrite: false })); sprite.scale.set(320, 31.25, 1); return sprite;
}
export default function Map3D(p: ViewProps) {
  const ref = useRef<ForceGraphMethods<DisplayNode, DisplayEdge> | undefined>(undefined);
  const graphData = useMemo(() => ({ nodes: p.nodes, links: p.links }), [p.nodes, p.links]);
  const neighbors = useMemo(() => related(p.nodes, p.links, p.selected), [p.nodes, p.links, p.selected]);
  const objects = useMemo(() => {
    const map = new Map<string, Group>();
    for (const n of p.nodes) {
      const group = new Group();
      if (n.kind === 'department') {
        group.add(new Mesh(new RingGeometry(74, 74.5, 64), new MeshBasicMaterial({ color: '#c7d0dc', side: DoubleSide, transparent: true, opacity: .8 })));
        const text = label(`${n.name}  ·  ${n.count}개`); text.position.y = 94; text.visible = !p.focusSelection; group.add(text);
      } else {
        const emphasis = n.id === p.selected || (p.searching && p.highlighted.has(n.id));
        let geometry: BufferGeometry = new SphereGeometry(6, 20, 16);
        if (n.kind === 'lab') geometry = new BoxGeometry(11, 11, 11);
        if (n.kind === 'equipment') geometry = new OctahedronGeometry(8);
        if (n.kind === 'space') { geometry = new CylinderGeometry(8, 8, 4, 24); geometry.rotateX(Math.PI / 2); }
        group.add(new Mesh(geometry, new MeshStandardMaterial({ color: emphasis ? '#2458d3' : colors[n.kind], roughness: .55, metalness: .08, transparent: true, opacity: p.selected ? (neighbors.has(n.id) ? 1 : .2) : p.searching && !p.highlighted.has(n.id) ? .35 : 1 })));
        const text = label(n.name); text.scale.multiplyScalar(.6); text.position.y = -18; text.visible = emphasis && (!p.selected || neighbors.has(n.id)); group.add(text);
      }
      map.set(n.id, group);
    }
    return map;
  }, [p.nodes, p.selected, p.searching, p.highlighted, neighbors, p.focusSelection]);
  const edgeObjects = useMemo(() => new Map(p.links.filter(e => p.selected && (endpointId(e.source) === p.selected || endpointId(e.target) === p.selected)).map(e => {
    const text = label(e.label); text.scale.multiplyScalar(.4); text.material.depthTest = false;
    return [e.id, text] as const;
  })), [p.links, p.selected]);
  useEffect(() => () => { for (const object of [...objects.values(), ...edgeObjects.values()]) object.traverse(child => {
    if (child instanceof Mesh) child.geometry.dispose();
    if (child instanceof Mesh || child instanceof Sprite) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) { if ('map' in material && material.map instanceof CanvasTexture) material.map.dispose(); material.dispose(); }
    }
  }); }, [objects, edgeObjects]);
  useEffect(() => {
    const home = () => {
      const graph = ref.current; if (!graph || !p.nodes.length) return;
      const xs = p.nodes.map(n => n.fx), ys = p.nodes.map(n => n.fy);
      const centerX = (Math.min(...xs) + Math.max(...xs)) / 2, centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
      const camera = graph.camera(); const fov = camera instanceof PerspectiveCamera ? camera.fov : 50;
      const tangent = Math.tan(fov * Math.PI / 360), aspect = p.width / Math.max(1, p.height);
      const distance = Math.max((Math.max(...xs)-Math.min(...xs)+240)/(2*tangent*aspect), (Math.max(...ys)-Math.min(...ys)+240)/(2*tangent));
      graph.cameraPosition({x:centerX,y:centerY,z:Math.max(...p.nodes.map(n => n.fz))+distance*1.1}, {x:centerX,y:centerY,z:0}, p.reducedMotion ? 0 : 500);
    };
    const handle = { home, zoom: (factor: number) => {
      const graph = ref.current; if (!graph) return;
      const target = (graph.controls() as { target?: Vector3 }).target?.clone() ?? new Vector3();
      const position = graph.camera().position.clone().sub(target).divideScalar(factor).add(target);
      graph.cameraPosition(position, target, p.reducedMotion ? 0 : 250);
    }, focus: (id: string) => { const n = p.nodes.find(n => n.id === id); if (n) ref.current?.cameraPosition({ x: n.fx, y: n.fy, z: n.fz + 230 }, { x: n.fx, y: n.fy, z: n.fz }, p.reducedMotion ? 0 : 450); } };
    p.onReady(handle);
    const graph = ref.current;
    if (graph) { const scene = graph.scene(); const ambient = new AmbientLight(0xffffff, 2); const light = new DirectionalLight(0xffffff, 3); light.position.set(-200, 400, 700); scene.add(ambient, light);
      const canvas = graph.renderer().domElement; const onLoss = (event: Event) => { event.preventDefault(); p.onFailure(); }; canvas.addEventListener('webglcontextlost', onLoss);
      const timer = setTimeout(() => p.focusSelection && p.selected && p.nodes.some(n => n.id === p.selected) ? handle.focus(p.selected) : home(), 80);
      return () => { clearTimeout(timer); canvas.removeEventListener('webglcontextlost', onLoss); scene.remove(ambient, light); };
    }
  }, [p.nodes, p.width, p.height, p.reducedMotion, p.onReady, p.onFailure, p.selected, p.focusSelection]);
  useEffect(() => {
    const graph = ref.current; if (!graph) return;
    const controls = graph.controls() as { addEventListener(type: 'change', listener: () => void): void; removeEventListener(type: 'change', listener: () => void): void };
    const update = () => {
      const camera = graph.camera();
      for (const n of p.nodes) {
        if (n.kind === 'department') continue;
        const text = objects.get(n.id)?.children[1];
        if (text) text.visible = (!p.selected || neighbors.has(n.id)) && (n.id === p.selected || (p.searching && p.highlighted.has(n.id)) || camera.position.distanceTo(new Vector3(n.fx, n.fy, n.fz)) < 450);
      }
    };
    controls.addEventListener('change', update); update();
    return () => controls.removeEventListener('change', update);
  }, [objects, p.nodes, p.selected, p.searching, p.highlighted, neighbors]);
  return <ForceGraph3D<DisplayNode, DisplayEdge> ref={ref} graphData={graphData} width={p.width} height={p.height} backgroundColor="#f6f7f9" showNavInfo={false} nodeThreeObject={n => objects.get(n.id)!} nodeLabel={n => escapeHtml(n.name)} linkLabel={e => escapeHtml(e.label)} linkColor={e => p.selected && (endpointId(e.source) === p.selected || endpointId(e.target) === p.selected) ? '#2458d3' : '#b7c2d1'} linkOpacity={.5} linkWidth={.8} linkThreeObjectExtend linkThreeObject={e => edgeObjects.get(e.id)!} linkPositionUpdate={(object, {start, end}) => { if (object) object.position.set((start.x+end.x)/2, (start.y+end.y)/2+5, (start.z+end.z)/2); return true; }} onNodeClick={n => n.kind !== 'department' && p.onSelect(n.id)} enableNodeDrag={false} cooldownTicks={0} />;
}

import { useEffect, useMemo, useRef } from 'react';
import ForceGraph3D, { type ForceGraphMethods } from 'react-force-graph-3d';
import { BoxGeometry, CanvasTexture, CylinderGeometry, DoubleSide, Group, Mesh, MeshStandardMaterial, OctahedronGeometry, RingGeometry, SphereGeometry, Sprite, SpriteMaterial, AmbientLight, DirectionalLight, Vector3, type BufferGeometry } from 'three';
import { colors, endpointId, escapeHtml, related, type DisplayNode, type DisplayEdge, type ViewProps } from './map-model';
function label(text: string) {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 100;
  const ctx = canvas.getContext('2d')!; ctx.font = '500 36px sans-serif'; ctx.fillStyle = '#46566d'; ctx.textAlign = 'center'; ctx.fillText(text, 512, 60);
  const texture = new CanvasTexture(canvas); const sprite = new Sprite(new SpriteMaterial({ map: texture, transparent: true, depthWrite: false })); sprite.scale.set(210, 21, 1); return sprite;
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
        group.add(new Mesh(new RingGeometry(74, 74.5, 64), new MeshStandardMaterial({ color: '#dbe1e9', side: DoubleSide, transparent: true, opacity: .8 })));
        const text = label(`${n.name}  ·  ${n.count}개`); text.position.y = 94; group.add(text);
      } else {
        const emphasis = n.id === p.selected || (p.searching && p.highlighted.has(n.id));
        let geometry: BufferGeometry = new SphereGeometry(6, 20, 16);
        if (n.kind === 'lab') geometry = new BoxGeometry(11, 11, 11);
        if (n.kind === 'equipment') geometry = new OctahedronGeometry(8);
        if (n.kind === 'space') { geometry = new CylinderGeometry(8, 8, 4, 24); geometry.rotateX(Math.PI / 2); }
        group.add(new Mesh(geometry, new MeshStandardMaterial({ color: emphasis ? '#2458d3' : colors[n.kind], roughness: .55, metalness: .08, transparent: true, opacity: p.selected && !neighbors.has(n.id) ? .2 : p.searching && !p.highlighted.has(n.id) ? .35 : 1 })));
        const text = label(n.name); text.scale.multiplyScalar(.6); text.position.y = -18; text.visible = emphasis; group.add(text);
      }
      map.set(n.id, group);
    }
    return map;
  }, [p.nodes, p.selected, p.searching, p.highlighted, neighbors]);
  useEffect(() => () => { for (const object of objects.values()) object.traverse(child => {
    if (child instanceof Mesh) child.geometry.dispose();
    if (child instanceof Mesh || child instanceof Sprite) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) { if ('map' in material && material.map instanceof CanvasTexture) material.map.dispose(); material.dispose(); }
    }
  }); }, [objects]);
  useEffect(() => {
    const home = () => ref.current?.cameraPosition({ x: 0, y: 0, z: 1000 }, { x: 0, y: 0, z: 0 }, p.reducedMotion ? 0 : 500);
    p.onReady({ home, zoom: factor => { const graph = ref.current; if (!graph) return; const position = graph.camera().position; graph.cameraPosition({ x: position.x / factor, y: position.y / factor, z: position.z / factor }, undefined, p.reducedMotion ? 0 : 250); }, focus: id => { const n = p.nodes.find(n => n.id === id); if (n) ref.current?.cameraPosition({ x: n.fx, y: n.fy, z: n.fz + 230 }, { x: n.fx, y: n.fy, z: n.fz }, p.reducedMotion ? 0 : 450); } });
    const graph = ref.current;
    if (graph) { const scene = graph.scene(); const ambient = new AmbientLight(0xffffff, 2); const light = new DirectionalLight(0xffffff, 3); light.position.set(-200, 400, 700); scene.add(ambient, light);
      const canvas = graph.renderer().domElement; const onLoss = (event: Event) => { event.preventDefault(); p.onFailure(); }; canvas.addEventListener('webglcontextlost', onLoss);
      const timer = setTimeout(home, 80);
      return () => { clearTimeout(timer); canvas.removeEventListener('webglcontextlost', onLoss); scene.remove(ambient, light); };
    }
  }, [p.nodes, p.reducedMotion, p.onReady, p.onFailure]);
  useEffect(() => {
    const graph = ref.current; if (!graph) return;
    const controls = graph.controls() as { addEventListener(type: 'change', listener: () => void): void; removeEventListener(type: 'change', listener: () => void): void };
    const update = () => {
      const camera = graph.camera();
      for (const n of p.nodes) {
        if (n.kind === 'department') continue;
        const text = objects.get(n.id)?.children[1];
        if (text) text.visible = n.id === p.selected || (p.searching && p.highlighted.has(n.id)) || camera.position.distanceTo(new Vector3(n.fx, n.fy, n.fz)) < 450;
      }
    };
    controls.addEventListener('change', update); update();
    return () => controls.removeEventListener('change', update);
  }, [objects, p.nodes, p.selected, p.searching, p.highlighted]);
  return <ForceGraph3D<DisplayNode, DisplayEdge> ref={ref} graphData={graphData} width={p.width} height={p.height} backgroundColor="#f6f7f9" showNavInfo={false} nodeThreeObject={n => objects.get(n.id)!} nodeLabel={n => escapeHtml(n.name)} linkLabel={e => escapeHtml(e.label)} linkColor={e => p.selected && (endpointId(e.source) === p.selected || endpointId(e.target) === p.selected) ? '#2458d3' : '#b7c2d1'} linkOpacity={.5} linkWidth={.5} onNodeClick={n => n.kind !== 'department' && p.onSelect(n.id)} enableNodeDrag={false} cooldownTicks={0} />;
}

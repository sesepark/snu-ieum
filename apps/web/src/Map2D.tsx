import { useEffect, useMemo, useRef } from 'react';
import ForceGraph2D, { type ForceGraphMethods } from 'react-force-graph-2d';
import { colors, endpointId, escapeHtml, related, type DisplayNode, type DisplayEdge, type ViewProps } from './map-model';
export default function Map2D(p: ViewProps) {
  const ref = useRef<ForceGraphMethods<DisplayNode, DisplayEdge> | undefined>(undefined);
  const graphData = useMemo(() => ({ nodes: p.nodes, links: p.links }), [p.nodes, p.links]);
  const neighbors = useMemo(() => related(p.nodes, p.links, p.selected), [p.nodes, p.links, p.selected]);
  useEffect(() => {
    const home = () => ref.current?.zoomToFit(p.reducedMotion ? 0 : 400, 75);
    const handle = { home, zoom: (f: number) => { const graph = ref.current; if (graph) graph.zoom(graph.zoom() * f, p.reducedMotion ? 0 : 250); }, focus: (id: string) => { const n = p.nodes.find(n => n.id === id); if (n) { ref.current?.centerAt(n.fx, n.fy, p.reducedMotion ? 0 : 350); ref.current?.zoom(p.width < 650 ? 1.25 : 2, p.reducedMotion ? 0 : 350); } } };
    p.onReady(handle);
    const timer = setTimeout(() => p.focusSelection && p.selected && p.nodes.some(n => n.id === p.selected) ? handle.focus(p.selected) : home(), 80); return () => clearTimeout(timer);
  }, [p.nodes, p.width, p.height, p.reducedMotion, p.onReady, p.selected, p.focusSelection]);
  const draw = (n: DisplayNode, ctx: CanvasRenderingContext2D, scale: number) => {
    const x = n.x ?? n.fx, y = n.y ?? n.fy;
    ctx.save();
    if (n.kind === 'department') {
      ctx.strokeStyle = '#d9dfe8'; ctx.lineWidth = 1 / scale; ctx.setLineDash([3 / scale, 5 / scale]);
      ctx.beginPath(); ctx.arc(x, y, 76, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      if (p.focusSelection) { ctx.restore(); return; }
      const compact = p.width < 650 && scale < .8;
      const name = compact ? n.name.replace(/공학(과|부)$|학(과|부)$/g, '').slice(0, 6) : n.name;
      ctx.fillStyle = '#596578'; ctx.font = `500 ${(compact ? 9 : 12) / scale}px sans-serif`; ctx.textAlign = 'center';
      ctx.fillText(name, x, y - 91); ctx.font = `${Math.max(8, 10 / scale)}px sans-serif`; ctx.fillStyle = '#768294'; ctx.fillText(`${n.count}개 수록`, x, y - 77);
      ctx.restore(); return;
    }
    const selected = n.id === p.selected;
    const emphasis = selected || (p.searching && p.highlighted.has(n.id));
    ctx.globalAlpha = p.selected && !neighbors.has(n.id) ? .22 : p.searching && !p.highlighted.has(n.id) ? .35 : 1;
    ctx.fillStyle = emphasis ? '#2458d3' : colors[n.kind];
    ctx.beginPath();
    if (n.kind === 'lab') ctx.roundRect(x - 6, y - 6, 12, 12, 2);
    else if (n.kind === 'equipment') { ctx.moveTo(x, y - 8); ctx.lineTo(x + 7, y); ctx.lineTo(x, y + 8); ctx.lineTo(x - 7, y); ctx.closePath(); }
    else if (n.kind === 'space') ctx.roundRect(x - 8, y - 4, 16, 8, 4);
    else ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    if (emphasis) { ctx.strokeStyle = '#2458d3'; ctx.lineWidth = 1.5 / scale; ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.stroke(); }
    if (scale > 1.05 || emphasis) { ctx.fillStyle = '#1d2838'; ctx.font = `${11 / scale}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText(n.name, x, y + 18 / scale); }
    ctx.restore();
  };
  return <ForceGraph2D<DisplayNode, DisplayEdge> ref={ref} graphData={graphData} width={p.width} height={p.height} backgroundColor="#f6f7f9" nodeCanvasObject={draw} nodeLabel={n => escapeHtml(n.name)} linkLabel={e => escapeHtml(e.label)} linkColor={e => p.selected && (endpointId(e.source) === p.selected || endpointId(e.target) === p.selected) ? '#2458d3' : '#cbd3df'} linkWidth={1} linkCanvasObjectMode={() => 'after'} linkCanvasObject={(edge, ctx, scale) => {
    if (!p.selected || (endpointId(edge.source) !== p.selected && endpointId(edge.target) !== p.selected) || typeof edge.source === 'string' || typeof edge.target === 'string') return;
    ctx.save(); ctx.font = `${10 / scale}px sans-serif`; ctx.fillStyle = '#2458d3'; ctx.textAlign = 'center';
    ctx.fillText(edge.label, ((edge.source.x ?? 0) + (edge.target.x ?? 0)) / 2, ((edge.source.y ?? 0) + (edge.target.y ?? 0)) / 2 - 6 / scale); ctx.restore();
  }} onNodeClick={n => n.kind !== 'department' && p.onSelect(n.id)} enableNodeDrag={false} cooldownTicks={0} onEngineStop={() => {}} />;
}

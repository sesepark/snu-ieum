import type { Department, Graph, GraphNode } from '@ieum/contracts';
export type DisplayNode = { id: string; name: string; kind: GraphNode['kind'] | 'department'; departmentId: string; count?: number; fx: number; fy: number; fz: number; x?: number; y?: number; z?: number };
export type DisplayEdge = { id: string; source: string | DisplayNode; target: string | DisplayNode; label: string };
export type MapHandle = { home(): void; zoom(factor: number): void; focus(id: string): void };
export type ViewProps = { nodes: DisplayNode[]; links: DisplayEdge[]; width: number; height: number; selected?: string; highlighted: Set<string>; searching: boolean; reducedMotion: boolean; onSelect(id: string): void; onReady(handle: MapHandle): void; onFailure(): void };
export const colors: Record<DisplayNode['kind'], string> = { department: '#8d98a8', researcher: '#795a99', lab: '#367b68', equipment: '#986324', space: '#456e8a', paper: '#757b85', thesis: '#757b85' };
export const endpointId = (value: string | DisplayNode) => typeof value === 'string' ? value : value.id;
export const escapeHtml = (text: string) => text.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
export function model(data: Graph, departments: Department[]) {
  const nodes: DisplayNode[] = [];
  for (const [i, d] of departments.entries()) {
    const x = (i % 4 - 1.5) * 230, y = (Math.floor(i / 4) - 1) * 190, z = Math.sin(i * 1.7) * 20;
    const resources = data.nodes.filter(n => n.departmentId === d.id);
    nodes.push({ id: `group:${d.id}`, name: d.name, departmentId: d.id, kind: 'department', count: resources.length, fx: x, fy: y, fz: z });
    for (const [j, r] of resources.entries()) {
      const angle = j * 2.399963;
      const radius = 42 + Math.sqrt(j) * 10;
      nodes.push({ ...r, fx: x + Math.cos(angle) * radius, fy: y + Math.sin(angle) * radius, fz: z + (j % 3 - 1) * 22 });
    }
  }
  return { nodes, links: data.edges.map(e => ({ id: e.id, source: e.source, target: e.target, label: e.label })) };
}
export function related(nodes: DisplayNode[], links: DisplayEdge[], selected?: string) {
  const ids = new Set(selected ? [selected] : nodes.map(n => n.id));
  if (selected) for (const e of links) {
    const a = endpointId(e.source), b = endpointId(e.target);
    if (a === selected) ids.add(b); if (b === selected) ids.add(a);
  }
  return ids;
}

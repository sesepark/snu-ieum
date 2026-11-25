import type { Campus, Evidence, Filters, Resource, Snapshot } from '@ieum/contracts';
import { filteredResources } from '@ieum/catalog';
import { mappedLocations } from '../../../packages/catalog/src/campus';

export type Kind = Resource['kind'];
export const kindOrder: Kind[] = ['researcher', 'lab', 'equipment', 'space'];
/** Bright tones used on the dark campus scene. */
export const glow: Record<Kind, string> = { researcher: '#b69cff', lab: '#42e0a4', equipment: '#ffbe55', space: '#5cc8ff' };
export const evidenceGlow = '#ffe08a';

export type LinkLayer = 'official' | 'evidence' | 'department';
export type NetworkLink = {
  id: string; layer: LinkLayer; from: string; to: string; label: string;
  fromKind?: Kind; toKind?: Kind; weight: number; sourceIds: string[]; departmentId?: string; resourceIds: string[];
};
export type BuildingStack = { buildingId: string; counts: Record<Kind, number>; total: number; internalRelations: number };

/**
 * Building-level network shown on the campus. Three layers are kept separate so the UI can say
 * exactly what each line means:
 * - official: a published relation (지도교수, 설치 호실) whose two resources sit in different buildings
 * - evidence: a reviewed paper/thesis that names resources located in different buildings
 * - department: one department's resources are located in both buildings (distribution, not collaboration)
 */
export function networkModel(c: Campus, s: Snapshot, f: Filters) {
  const allowed = new Set(filteredResources(s, { ...f, q: '' }).map(r => r.id));
  const kinds = new Map(s.resources.map(r => [r.id, r.kind]));
  const where = new Map<string, string>();
  for (const l of mappedLocations(c, s)) if (l.buildingId && allowed.has(l.resourceId) && !where.has(l.resourceId)) where.set(l.resourceId, l.buildingId);

  const stacks = new Map<string, BuildingStack>();
  for (const [id, buildingId] of where) {
    const stack = stacks.get(buildingId) ?? { buildingId, counts: { researcher: 0, lab: 0, equipment: 0, space: 0 }, total: 0, internalRelations: 0 };
    stack.counts[kinds.get(id)!]++; stack.total++; stacks.set(buildingId, stack);
  }

  const official = new Map<string, NetworkLink>();
  for (const e of s.relations) {
    const a = where.get(e.from), b = where.get(e.to);
    if (!a || !b) continue;
    if (a === b) { stacks.get(a)!.internalRelations++; continue; }
    const key = `${e.type}|${a}|${b}`;
    const link = official.get(key) ?? { id: `official:${key}`, layer: 'official' as const, from: a, to: b, label: e.label, fromKind: kinds.get(e.from), toKind: kinds.get(e.to), weight: 0, sourceIds: [], resourceIds: [] };
    link.weight++; link.sourceIds = [...new Set([...link.sourceIds, ...e.sourceIds])]; link.resourceIds.push(e.from, e.to);
    official.set(key, link);
  }

  const evidence = new Map<string, NetworkLink>();
  for (const doc of s.evidence) {
    const placed = doc.resourceIds.filter(id => where.has(id));
    for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) {
      const a = where.get(placed[i])!, b = where.get(placed[j])!;
      if (a === b) continue;
      const key = [a, b].sort().join('|');
      const link = evidence.get(key) ?? { id: `evidence:${key}`, layer: 'evidence' as const, from: a, to: b, label: doc.kind === 'thesis' ? '학위논문 근거' : '논문 근거', fromKind: kinds.get(placed[i]), toKind: kinds.get(placed[j]), weight: 0, sourceIds: [], resourceIds: [] };
      link.weight++; link.sourceIds = [...new Set([...link.sourceIds, ...doc.sourceIds])]; link.resourceIds.push(placed[i], placed[j]);
      evidence.set(key, link);
    }
  }

  const department: NetworkLink[] = [];
  for (const d of s.departments) {
    const counts = new Map<string, number>();
    for (const r of s.resources) if (r.departmentId === d.id && where.has(r.id)) counts.set(where.get(r.id)!, (counts.get(where.get(r.id)!) ?? 0) + 1);
    if (counts.size < 2) continue;
    const ranked = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const [hub] = ranked[0];
    for (const [buildingId, n] of ranked.slice(1)) department.push({ id: `department:${d.id}:${buildingId}`, layer: 'department', from: hub, to: buildingId, label: `${d.name} 자원 분포`, weight: n, sourceIds: [], departmentId: d.id, resourceIds: [] });
  }

  const hubs = new Map<string, string>();
  for (const d of s.departments) {
    const counts = new Map<string, number>();
    for (const r of s.resources) if (r.departmentId === d.id && where.has(r.id)) counts.set(where.get(r.id)!, (counts.get(where.get(r.id)!) ?? 0) + 1);
    const best = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    if (best) hubs.set(d.id, best[0]);
  }
  return { stacks: [...stacks.values()], links: [...official.values(), ...evidence.values(), ...department], located: where, hubs };
}
export type NetworkModel = ReturnType<typeof networkModel>;

export type EgoNode = { resource: Resource; ring: 1 | 2 | 3; relation: string; sourceIds: string[]; via?: string; buildingId?: string };
export type Ego = { center: Resource; buildingId?: string; nodes: EgoNode[]; evidence: Evidence[] };

/**
 * Neighbourhood of one resource:
 * ring 1 = official relations, ring 2 = relations of those neighbours, ring 3 = same building (location only).
 */
export function egoNetwork(s: Snapshot, c: Campus | undefined, id: string, options: { depth?: 1 | 2; colocated?: number } = {}): Ego | undefined {
  const center = s.resources.find(r => r.id === id);
  if (!center) return undefined;
  const where = new Map<string, string>();
  if (c) for (const l of mappedLocations(c, s)) if (l.buildingId && !where.has(l.resourceId)) where.set(l.resourceId, l.buildingId);
  const byId = new Map(s.resources.map(r => [r.id, r]));
  const nodes: EgoNode[] = [];
  const seen = new Set([id]);
  const add = (otherId: string, ring: 1 | 2 | 3, relation: string, sourceIds: string[], via?: string) => {
    const resource = byId.get(otherId);
    if (!resource || seen.has(otherId)) return;
    seen.add(otherId); nodes.push({ resource, ring, relation, sourceIds, via, buildingId: where.get(otherId) });
  };
  for (const e of s.relations) {
    if (e.from === id) add(e.to, 1, e.label, e.sourceIds);
    else if (e.to === id) add(e.from, 1, e.label, e.sourceIds);
  }
  if ((options.depth ?? 2) > 1) {
    for (const first of nodes.filter(n => n.ring === 1)) for (const e of s.relations) {
      if (e.from === first.resource.id) add(e.to, 2, e.label, e.sourceIds, first.resource.id);
      else if (e.to === first.resource.id) add(e.from, 2, e.label, e.sourceIds, first.resource.id);
    }
  }
  const evidence = s.evidence.filter(doc => doc.resourceIds.includes(id));
  for (const doc of evidence) for (const other of doc.resourceIds) add(other, 2, doc.kind === 'thesis' ? '학위논문 근거' : '논문 근거', doc.sourceIds);
  const home = where.get(id);
  if (home && (options.colocated ?? 6) > 0) {
    const kindRank = (r: Resource) => Number(r.kind === center.kind);
    const neighbours = [...where].filter(([other, b]) => b === home && !seen.has(other)).map(([other]) => byId.get(other)!).filter(Boolean)
      .sort((a, b) => kindRank(a) - kindRank(b) || a.name.localeCompare(b.name, 'ko'));
    for (const r of neighbours.slice(0, options.colocated ?? 6)) add(r.id, 3, '같은 건물', []);
  }
  return { center, buildingId: home, nodes, evidence };
}

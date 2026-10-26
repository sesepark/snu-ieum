import { RecommendationSchema, SnapshotSchema, type Snapshot, type Filters, type Catalog, type Graph, type Resource, type Recommendation } from '@ieum/contracts';

export const normalize = (text: string) => text.normalize('NFKC').toLocaleLowerCase('ko').replace(/[^\p{L}\p{N}]/gu, '');
// Only reviewed equivalents; never infer eligibility, relationships or identities.
const equivalents = [['인공지능', 'ai', 'artificialintelligence'], ['기계학습', '머신러닝', 'machinelearning'], ['데이터과학', '데이터사이언스', 'datascience']];
export function queryTerms(text: string) {
  return text.trim().split(/\s+/u).filter(Boolean).map(token => {
    const n = normalize(token);
    return equivalents.find(group => group.includes(n)) ?? [n];
  });
}
export const resourceText = (r: Resource, s: Snapshot) => normalize([r.name, r.summary, ...r.keywords, s.departments.find(d => d.id === r.departmentId)?.name ?? ''].join(' '));
export function filteredResources(s: Snapshot, f: Filters) {
  const terms = queryTerms(f.q);
  return s.resources.filter(r => (!f.kinds.length || f.kinds.includes(r.kind)) && (!f.departmentIds.length || f.departmentIds.includes(r.departmentId)) && terms.every(group => group.some(term => resourceText(r, s).includes(term))));
}
export function catalog(s: Snapshot): Catalog {
  const counts = (resources: Resource[]) => Object.fromEntries(['researcher', 'lab', 'equipment', 'space'].map(kind => [kind, resources.filter(r => r.kind === kind).length])) as Catalog['totals'];
  const departments = s.departments.map(d => {
    const resources = s.resources.filter(r => r.departmentId === d.id);
    return { ...d, counts: counts(resources), lastVerifiedAt: resources.map(r => r.lastVerifiedAt).sort().at(-1) ?? null };
  });
  const totals = counts(s.resources);
  const gaps: string[] = [];
  for (const d of departments) {
    if (d.counts.researcher < 3 || d.counts.lab < 3) gaps.push(`${d.name}: 교수 ${d.counts.researcher}/3 · 연구실 ${d.counts.lab}/3`);
    if (!s.evidence.some(e => e.resourceIds.some(id => s.resources.some(r => r.id === id && r.departmentId === d.id)))) gaps.push(`${d.name}: 논문 근거 미확보`);
  }
  if (totals.equipment < 20) gaps.push(`장비 ${totals.equipment}/20`);
  if (totals.space < 10) gaps.push(`공간 ${totals.space}/10`);
  if (s.manifest.publication !== 'approved') gaps.push('사람의 공개 배치 승인 대기');
  return { manifest: s.manifest, departments, totals, launchReady: gaps.length === 0, gaps };
}
export function recommend(s: Snapshot, f: Filters, semantic: Map<string, number> = new Map(), now = Date.now()): Recommendation[] {
  const ordinary = filteredResources(s, f);
  const candidates = semantic.size ? filteredResources(s, { ...f, q: '' }).filter(r => (Boolean(f.q) && ordinary.includes(r)) || semantic.has(r.id)) : ordinary;
  const direct = new Set(semantic.keys());
  const proximity = new Map<string, number>();
  let frontier = direct;
  for (let depth = 1; depth <= 2; depth++) {
    const next = new Set<string>();
    for (const e of s.relations) for (const [a, b] of [[e.from, e.to], [e.to, e.from]]) {
      if (frontier.has(a) && !direct.has(b) && !proximity.has(b)) { proximity.set(b, 1 / depth); next.add(b); }
    }
    frontier = next;
  }
  const all = semantic.size ? filteredResources(s, { ...f, q: '' }).filter(r => candidates.includes(r) || proximity.has(r.id)) : candidates;
  return all.map(r => {
    const source = s.sources.filter(source => r.sourceIds.includes(source.id));
    const age = Math.max(0, (now - Date.parse(r.lastVerifiedAt)) / 86400000);
    const ttl = r.kind === 'equipment' || r.kind === 'space' ? 7 : 30;
    const score = .45 * (semantic.get(r.id) ?? ((Boolean(f.q) || !semantic.size) && ordinary.includes(r) ? 1 : 0)) + .25 * (direct.has(r.id) ? 1 : proximity.get(r.id) ?? 0) + .2 * (source.some(s => s.sourceType === 'official-page') ? 1 : .5) + .1 * Math.max(0, 1 - age / 365);
    const relationIds = s.relations.filter(e => (e.from === r.id && (direct.has(e.to) || proximity.has(e.to))) || (e.to === r.id && (direct.has(e.from) || proximity.has(e.from)))).map(e => e.id);
    const result = RecommendationSchema.safeParse({ resource: r, source, score,
      reason: proximity.has(r.id) ? '공식 출처가 있는 관계로 검색 후보와 연결됩니다.' : semantic.has(r.id) && !ordinary.includes(r) ? '목표 해석과 승인된 연구 소개의 의미 유사도로 찾은 후보입니다.' : f.q ? `공식 소개의 이름·연구 분야·소속에서 검색어와 일치합니다.` : '공식 출처에서 확인한 수록 자원입니다.',
      lastVerifiedAt: r.lastVerifiedAt, verificationRequired: r.verificationRequired || age > ttl, relationIds });
    return result.success ? result.data : null;
  }).filter((r): r is Recommendation => r !== null).sort((a, b) => b.score - a.score || a.resource.name.localeCompare(b.resource.name, 'ko'));
}
export function graph(s: Snapshot, f: Filters, options: { focus?: string; depth?: number; evidence?: boolean; expanded?: boolean } = {}): Graph {
  const eligible = filteredResources(s, { ...f, q: '' }); // Search highlights the existing map; it never removes clusters.
  const allowed = new Set(eligible.map(r => r.id));
  let visible = allowed;
  if (options.focus) {
    visible = new Set(allowed.has(options.focus) ? [options.focus] : []);
    for (let hop = 0; hop < Math.min(2, options.depth ?? 1); hop++) {
      const next = new Set(visible);
      for (const edge of s.relations) if (allowed.has(edge.from) && allowed.has(edge.to)) {
        if (visible.has(edge.from)) next.add(edge.to);
        if (visible.has(edge.to)) next.add(edge.from);
      }
      visible = next;
    }
  }
  const limit = options.expanded ? 500 : 300;
  const selected = eligible.filter(r => visible.has(r.id)).sort((a, b) => Number(b.id === options.focus) - Number(a.id === options.focus)).slice(0, limit);
  const ids = new Set(selected.map(r => r.id));
  const nodes: Graph['nodes'] = selected.map(({ id, name, kind, departmentId, sourceIds }) => ({ id, name, kind, departmentId, sourceIds }));
  const edges: Graph['edges'] = s.relations.filter(e => ids.has(e.from) && ids.has(e.to)).map(e => ({ id: e.id, source: e.from, target: e.to, label: e.label, sourceIds: e.sourceIds, lastVerifiedAt: e.lastVerifiedAt }));
  let hiddenEvidence = 0;
  if (options.evidence && options.focus && ids.has(options.focus)) {
    for (const e of s.evidence.filter(e => e.resourceIds.includes(options.focus!))) {
      if (nodes.length >= 500) { hiddenEvidence++; continue; }
      const departmentId = selected.find(r => r.id === options.focus)!.departmentId;
      nodes.push({ id: e.id, name: e.title, kind: e.kind, departmentId, sourceIds: e.sourceIds });
      for (const id of e.resourceIds.filter(id => ids.has(id))) edges.push({ id: `${e.id}:${id}`, source: e.id, target: id, label: '논문 근거', sourceIds: e.sourceIds, lastVerifiedAt: e.lastVerifiedAt });
    }
  }
  return { nodes, edges: edges.slice(0, 1000), hiddenNodes: visible.size - selected.length + hiddenEvidence, hiddenEdges: Math.max(0, edges.length - 1000) };
}
export function parseSnapshot(input: unknown) { return SnapshotSchema.parse(input); }

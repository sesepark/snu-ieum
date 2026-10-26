import { CampusSchema, type Campus, type Snapshot, type ResourceLocation } from '@ieum/contracts';
export function parseCampus(input: unknown, snapshot: Snapshot, approvedOnly = false): Campus {
  const campus = CampusSchema.parse(input);
  if (campus.resourceVersion !== snapshot.manifest.version) throw new Error('Campus and research batch versions differ');
  if (approvedOnly && campus.manifest.publication !== 'approved') throw new Error('Human spatial batch review required');
  const purposes = { researcher: 'office', lab: 'lab', equipment: 'installation', space: 'space' } as const;
  for (const l of campus.locations) {
    const r = snapshot.resources.find(r => r.id === l.resourceId);
    if (!r) throw new Error(`Unknown location resource ${l.resourceId}`);
    if(l.status==='verified'&&!campus.buildings.some(b=>b.id===l.buildingId&&b.number&&b.identitySourceIds.length))throw new Error('Verified resource address needs an officially identified numbered building');
    if (l.purpose !== purposes[r.kind]) throw new Error(`Incorrect address purpose for ${r.id}`);
  }
  return campus;
}
export function mappedLocations(campus: Campus, snapshot: Snapshot, now = Date.now()) {
  if (campus.resourceVersion !== snapshot.manifest.version) return [];
  const purposes = { researcher: 'office', lab: 'lab', equipment: 'installation', space: 'space' } as const;
  return campus.locations.filter(l => {
    const r = snapshot.resources.find(r => r.id === l.resourceId);
    const b = campus.buildings.find(b => b.id === l.buildingId);
    const age = l.lastVerifiedAt ? (now - Date.parse(l.lastVerifiedAt)) / 86400000 : Infinity;
    const ttl = r?.kind === 'equipment' || r?.kind === 'space' ? 7 : 30;
    return r && l.purpose === purposes[r.kind] && l.status === 'verified' && l.sourceIds.length > 0 && l.sourceIds.every(id => campus.sources.some(s => s.id === id)) && age >= 0 && age <= ttl && b && b.identitySourceIds.length > 0 && (b.point || b.footprint);
  });
}
export function locationLabel(l: ResourceLocation | undefined) {
  return l?.status === 'verified' ? l.purpose === 'office' ? '교수실 위치 · 연구실 주소와 다를 수 있음' : l.purpose === 'installation' ? '장비 설치 위치 · 이용 가능 여부는 공식 안내 확인' : '공식 주소 근거' : l?.status === 'outdated' ? '이전 위치 · 재확인 필요' : '위치 확인 필요';
}
export function campusCoverage(campus: Campus, snapshot: Snapshot, now = Date.now()) {
  const mapped = mappedLocations(campus, snapshot, now), ids = new Set(mapped.map(l => l.resourceId));
  return { buildings: campus.buildings.length, officialIdentified: campus.buildings.filter(b => b.number && b.identitySourceIds.length).length, footprintMatched: campus.buildings.filter(b => b.number && b.footprint).length, officialInventoryComplete: campus.officialInventoryComplete, mappedResources: ids.size, unlocatedResources: snapshot.resources.length - ids.size, pendingFootprints: campus.buildings.filter(b => b.matchStatus !== 'verified').length, labs: { mapped: snapshot.resources.filter(r => r.kind === 'lab' && ids.has(r.id)).length, total: snapshot.resources.filter(r => r.kind === 'lab').length } };
}

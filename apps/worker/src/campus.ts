import { load } from 'cheerio';
import { CampusSchema, type Campus, type Building, type Snapshot } from '@ieum/contracts';
import { sanitize } from './privacy';
type Point = [number, number];
export const bounds = { west: 126.943, south: 37.444, east: 126.965, north: 37.471 };
export function contains(point: Point, ring: Point[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > point[1]) !== (yj > point[1]) && point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export function osmMetadata(xml: string) {
  const $ = load(xml, { xmlMode: true });
  const nodes = new Map<string, Point>();
  $('node').each((_, n) => { const e = $(n); nodes.set(e.attr('id')!, [Number(e.attr('lon')), Number(e.attr('lat'))]); });
  const features: { id: string; tags: Record<string, string>; points: Point[] }[] = [];
  $('way').each((_, n) => {
    const e = $(n), tags: Record<string, string> = {};
    e.children('tag').each((_, tag) => { const t = $(tag), key = t.attr('k')!; if (['name', 'name:ko', 'building', 'building:levels', 'height', 'highway', 'landuse', 'natural', 'ref'].includes(key)) tags[key] = t.attr('v')!; });
    if (!tags.building && !tags.highway && tags.landuse !== 'grass' && tags.natural !== 'wood') return;
    const points = e.children('nd').toArray().map(n => nodes.get($(n).attr('ref')!)).filter((n): n is Point => Boolean(n));
    if (points.length >= 2 && points.some(([x,y]) => x >= bounds.west && x <= bounds.east && y >= bounds.south && y <= bounds.north)) features.push({ id: `osm-way-${e.attr('id')}`, tags, points });
  });
  return sanitize({ version: 'osm-minimal-1', bounds, features }).payload as { version: string; bounds: typeof bounds; features: typeof features };
}
export function createCampus(raw: ReturnType<typeof osmMetadata>, official: { bdNo: string; bdNm: string; lat: string; lon: string }[], snapshot: Snapshot, now: string): Campus {
  const source = (id: string, url: string, title: string, license: string, redistribution: 'allowed' | 'metadata-only', attribution: string) => ({ id, url, title, license, redistribution, attribution, organization: id === 'osm' ? 'OpenStreetMap' : '서울대학교', retrievedAt: now, lastVerifiedAt: now, contentUpdatedAt: null });
  const sources: Campus['sources'] = [source('osm','https://www.openstreetmap.org/copyright','OpenStreetMap 관악 건물·도로','ODbL-1.0','allowed','© OpenStreetMap contributors'),source('snu-buildings','https://map.snu.ac.kr/web/main.action','서울대학교 캠퍼스맵 건물번호·명칭·좌표 최소 사실','공식 건물 최소 사실 · 원자료 재배포 허가 미확인','metadata-only','서울대학교 캠퍼스맵')];
  const buildings: Building[] = raw.features.filter(f => f.tags.building && f.points.length >= 4 && f.points[0][0] === f.points.at(-1)![0] && f.points[0][1] === f.points.at(-1)![1]).map(f => {
    const height = Number(f.tags.height), levels = Number(f.tags['building:levels']);
    const h = Number.isFinite(height) && height > 0 && height < 500 ? height : null, l = Number.isInteger(levels) && levels > 0 && levels <= 150 ? levels : null;
    return { id: f.id, number: null, name: f.tags['name:ko'] || f.tags.name || '건물명 확인 필요', footprint: { type: 'Polygon', coordinates: [f.points] }, point: null, geometrySourceIds: ['osm'], identitySourceIds: [], heightMeters: h ?? (l ? l * 3 : null), heightStatus: h ? 'approximate' : l ? 'levels-derived' : 'unknown', levels: l, collegeIds: [], matchStatus: 'unmatched', omissionReason: null, lastVerifiedAt: now };
  });
  for (const fact of official) {
    const point: Point = [Number(fact.lon), Number(fact.lat)];
    if (!point.every(Number.isFinite) || point[0] < bounds.west || point[0] > bounds.east || point[1] < bounds.south || point[1] > bounds.north) continue;
    const matches = buildings.filter(b => b.footprint && contains(point, b.footprint.coordinates[0]));
    // Use the official point as identity. Unambiguous containing geometry is a candidate match until reviewed.
    const geometry = matches.length === 1 && matches[0].identitySourceIds.length === 0 ? matches[0] : null;
    if (geometry) {
      geometry.id = `snu-${fact.bdNo}`; geometry.number = fact.bdNo; geometry.name = fact.bdNm; geometry.point = point; geometry.identitySourceIds = ['snu-buildings']; geometry.matchStatus = 'candidate';
    } else buildings.push({ id: `snu-${fact.bdNo}`, number: fact.bdNo, name: fact.bdNm, footprint: null, point, geometrySourceIds: ['snu-buildings'], identitySourceIds: ['snu-buildings'], heightMeters: null, heightStatus: 'unknown', levels: null, collegeIds: [], matchStatus: 'verified', omissionReason: '공식 좌표만 확보 · 일치하는 건물 윤곽 검수 필요', lastVerifiedAt: now });
  }
  const locations: Campus['locations'] = snapshot.resources.map(r => ({ id: `location-${r.id}`, resourceId: r.id, buildingId: null, purpose: r.kind === 'researcher' ? 'office' : r.kind === 'equipment' ? 'installation' : r.kind === 'space' ? 'space' : 'lab', room: null, status: 'unknown', sourceIds: [], addressText: null, lastVerifiedAt: null, reason: '공식 상세 주소·건물 연결 확인 필요' }));
  return CampusSchema.parse({ manifest: { version: 'campus-20261027', generatedAt: now, publication: 'prototype', schemaVersion: 1, selectionReason: 'OSM 실제 건물·도로와 공식 지도 최소 사실의 미승인 공간 초안. 공식 전수 목록·위치·윤곽 대조 검수 진행 중.' }, resourceVersion: snapshot.manifest.version, sources, colleges: [], buildings, locations, paths: raw.features.filter(f => !f.tags.building).map(f => ({ id: f.id, kind: f.tags.highway ? ['footway','path','steps','pedestrian'].includes(f.tags.highway) ? 'footway' : 'road' : 'green', points: f.points, sourceIds: ['osm'] })), terrain: null, officialInventoryComplete: false, inventorySourceIds: ['snu-buildings'] });
}

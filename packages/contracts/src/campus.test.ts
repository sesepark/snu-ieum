import { describe, expect, it } from 'vitest';
import { CampusSchema, BuildingSchema, ResourceLocationSchema } from './index';
const date = '2026-10-27T00:00:00Z';
const building = { id: 'b1', number: '301', name: '제1공학관', footprint: null, point: [126.952, 37.45], geometrySourceIds: ['osm'], identitySourceIds: ['official'], heightMeters: null, heightStatus: 'unknown', levels: null, collegeIds: [], matchStatus: 'verified', omissionReason: null, lastVerifiedAt: date };
const source = (id: string) => ({ id, url: 'https://map.snu.ac.kr/web/main.action', title: id, organization: 'SNU', license: 'metadata', attribution: 'SNU', retrievedAt: date, lastVerifiedAt: date, contentUpdatedAt: null, redistribution: 'metadata-only' });
const campus = () => ({ manifest: { version: 'campus-1', generatedAt: date, publication: 'prototype', selectionReason: 'test', schemaVersion: 1 }, resourceVersion: 'resources-1', sources: [source('osm'), source('official')], colleges: [], buildings: [building], locations: [], paths: [], terrain: null, officialInventoryComplete: false, inventorySourceIds: [] });
describe('campus evidence contracts', () => {
  it('rejects claimed verified buildings and plotted geometry without their respective sources', () => {
    expect(BuildingSchema.safeParse(building).success).toBe(true);
    expect(BuildingSchema.safeParse({ ...building, identitySourceIds: [] }).success).toBe(false);
    expect(BuildingSchema.safeParse({ ...building, geometrySourceIds: [] }).success).toBe(false);
    expect(BuildingSchema.safeParse({ ...building, point: null }).success).toBe(false);
  });
  it('requires official evidence and date for a verified resource location', () => {
    const location = { id: 'l', resourceId: 'lab', buildingId: 'b1', purpose: 'lab', room: null, status: 'verified', sourceIds: ['official'], addressText: '301동', lastVerifiedAt: date, reason: null };
    expect(ResourceLocationSchema.safeParse(location).success).toBe(true);
    expect(ResourceLocationSchema.safeParse({ ...location, sourceIds: [] }).success).toBe(false);
    expect(ResourceLocationSchema.safeParse({ ...location, status: 'unknown', buildingId: null }).success).toBe(false);
  });
  it('checks cross references, duplicate IDs, ring closure and DEM dimensions', () => {
    expect(CampusSchema.safeParse(campus()).success).toBe(true);
    expect(CampusSchema.safeParse({ ...campus(), sources: [source('osm')] }).success).toBe(false);
    expect(CampusSchema.safeParse({ ...campus(), buildings: [building, building] }).success).toBe(false);
    expect(BuildingSchema.safeParse({ ...building, footprint: { type: 'Polygon', coordinates: [[[126.95,37.45],[126.96,37.45],[126.96,37.46],[126.95,37.46]]] } }).success).toBe(false);
    expect(CampusSchema.safeParse({ ...campus(), terrain: { sourceIds: ['osm'], west: 126.94, east: 126.96, south: 37.44, north: 37.47, columns: 2, rows: 2, heights: [100], resolutionMeters: 30, kind: 'DSM' } }).success).toBe(false);
    expect(CampusSchema.safeParse({ ...campus(), officialInventoryComplete: true }).success).toBe(false);
  });
});

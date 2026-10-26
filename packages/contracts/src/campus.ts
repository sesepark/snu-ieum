import { z } from 'zod';
import { Id, ManifestSchema } from './base.ts';
const DateTime = z.iso.datetime({ offset: true });
const Text = z.string().trim().min(1).max(2000);
const Url = z.url().refine(v => new URL(v).protocol === 'https:' && !new URL(v).username && !new URL(v).password);
export const CoordinateSchema = z.tuple([z.number().finite().min(126).max(128), z.number().finite().min(36).max(38)]);
const Ring = z.array(CoordinateSchema).min(4).max(5000).refine(r => r[0][0] === r.at(-1)![0] && r[0][1] === r.at(-1)![1], 'Polygon ring must close');
export const FootprintSchema = z.object({ type: z.literal('Polygon'), coordinates: z.array(Ring).min(1).max(100) });
export const SpatialSourceSchema = z.strictObject({ id: Id, url: Url, title: Text, organization: Text, license: Text, attribution: Text, retrievedAt: DateTime, lastVerifiedAt: DateTime, contentUpdatedAt: DateTime.nullable(), redistribution: z.enum(['allowed', 'metadata-only', 'unconfirmed']) });
export const BuildingSchema = z.strictObject({
  id: Id, number: Text.nullable(), name: Text, footprint: FootprintSchema.nullable(), point: CoordinateSchema.nullable(),
  geometrySourceIds: z.array(Id), identitySourceIds: z.array(Id),
  heightMeters: z.number().positive().max(500).nullable(), heightStatus: z.enum(['measured', 'levels-derived', 'approximate', 'unknown']),
  levels: z.number().int().positive().max(150).nullable(), collegeIds: z.array(Id),
  matchStatus: z.enum(['verified', 'candidate', 'unmatched']), omissionReason: Text.nullable(), lastVerifiedAt: DateTime
}).superRefine((b, ctx) => {
  if ((b.footprint || b.point) && !b.geometrySourceIds.length) ctx.addIssue({ code: 'custom', message: 'Geometry source required' });
  if (b.matchStatus === 'verified' && !b.identitySourceIds.length) ctx.addIssue({ code: 'custom', message: 'Official building identity source required' });
  if (!b.footprint && !b.point && !b.omissionReason) ctx.addIssue({ code: 'custom', message: 'Missing geometry needs omission reason' });
  if (b.heightStatus !== 'unknown' && b.heightMeters === null) ctx.addIssue({ code: 'custom', message: 'Height required for stated height status' });
});
export const ResourceLocationSchema = z.strictObject({
  id: Id, resourceId: Id, buildingId: Id.nullable(), purpose: z.enum(['lab', 'office', 'installation', 'space']),
  room: Text.nullable(), status: z.enum(['verified', 'needs-review', 'unknown', 'outdated']), sourceIds: z.array(Id),
  addressText: Text.nullable(), lastVerifiedAt: DateTime.nullable(), reason: Text.nullable()
}).superRefine((l, ctx) => {
  if (l.status === 'verified' && (!l.buildingId || !l.sourceIds.length || !l.lastVerifiedAt)) ctx.addIssue({ code: 'custom', message: 'Verified location requires building, source and verification date' });
  if (l.status !== 'verified' && !l.reason) ctx.addIssue({ code: 'custom', message: 'Unverified location requires reason' });
});
export const CollegeSchema = z.strictObject({ id: Id, name: Text, sourceIds: z.array(Id).min(1) });
export const TerrainSchema = z.strictObject({ sourceIds: z.array(Id).min(1), west: z.number(), south: z.number(), east: z.number(), north: z.number(), columns: z.number().int().min(2).max(512), rows: z.number().int().min(2).max(512), heights: z.array(z.number().finite().nullable()).max(262144), resolutionMeters: z.number().positive(), kind: z.literal('DSM') }).superRefine((t, c) => {
  if (t.heights.length !== t.columns * t.rows || t.east <= t.west || t.north <= t.south) c.addIssue({ code: 'custom', message: 'Invalid terrain grid' });
});
export const CampusSchema = z.strictObject({
  manifest: ManifestSchema, resourceVersion: Id, sources: z.array(SpatialSourceSchema), colleges: z.array(CollegeSchema),
  buildings: z.array(BuildingSchema), locations: z.array(ResourceLocationSchema),
  paths: z.array(z.strictObject({ id: Id, kind: z.enum(['road', 'footway', 'green']), points: z.array(CoordinateSchema).min(2), sourceIds: z.array(Id).min(1) })),
  terrain: TerrainSchema.nullable(), officialInventoryComplete: z.boolean(), inventorySourceIds: z.array(Id)
}).superRefine((s, c) => {
  for (const group of [s.sources, s.colleges, s.buildings, s.locations, s.paths]) if (new Set(group.map(x => x.id)).size !== group.length) c.addIssue({ code: 'custom', message: 'Duplicate campus ID' });
  const sources = new Set(s.sources.map(x => x.id)), buildings = new Set(s.buildings.map(x => x.id)), colleges = new Set(s.colleges.map(x => x.id));
  for (const record of [...s.colleges, ...s.locations, ...s.paths]) for (const id of record.sourceIds) if (!sources.has(id)) c.addIssue({ code: 'custom', message: `Unknown campus source ${id}` });
  for (const b of s.buildings) {
    for (const id of [...b.geometrySourceIds, ...b.identitySourceIds]) if (!sources.has(id)) c.addIssue({ code: 'custom', message: `Unknown building source ${id}` });
    for (const id of b.collegeIds) if (!colleges.has(id)) c.addIssue({ code: 'custom', message: `Unknown college ${id}` });
  }
  for (const l of s.locations) if (l.buildingId && !buildings.has(l.buildingId)) c.addIssue({ code: 'custom', message: `Unknown building ${l.buildingId}` });
  for (const id of [...s.inventorySourceIds, ...(s.terrain?.sourceIds ?? [])]) if (!sources.has(id)) c.addIssue({ code: 'custom', message: `Unknown campus source ${id}` });
  if (s.officialInventoryComplete && !s.inventorySourceIds.length) c.addIssue({ code: 'custom', message: 'Official inventory source required' });
});
export type Campus = z.infer<typeof CampusSchema>;
export type Building = z.infer<typeof BuildingSchema>;
export type ResourceLocation = z.infer<typeof ResourceLocationSchema>;

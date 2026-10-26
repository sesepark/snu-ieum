import { z } from 'zod';

export const Id = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/);
const Text = z.string().trim().min(1).max(2000);
const DateTime = z.iso.datetime({ offset: true });
const HttpsUrl = z.url().refine(value => new URL(value).protocol === 'https:' && !new URL(value).username && !new URL(value).password, 'HTTPS source required');
export const ResourceKind = z.enum(['researcher', 'lab', 'equipment', 'space']);
export const CollectionKind = z.enum(['researcher', 'lab', 'equipment', 'space', 'paper', 'thesis', 'course', 'club', 'competition', 'program']);
export const SourceSchema = z.strictObject({
  id: Id, url: HttpsUrl, organization: Text, title: Text,
  sourceType: z.enum(['official-page', 'openalex', 's-space']),
  retrievedAt: DateTime, lastVerifiedAt: DateTime
});
export const ResourceSchema = z.strictObject({
  id: Id, kind: ResourceKind, name: Text, summary: Text,
  departmentId: Id, keywords: z.array(Text).max(40), sourceIds: z.array(Id).min(1),
  lastVerifiedAt: DateTime, verificationRequired: z.boolean()
});
export const RelationSchema = z.strictObject({
  id: Id, from: Id, to: Id, type: z.enum(['LEADS', 'LOCATED_AT', 'USES', 'BELONGS_TO']),
  label: Text, sourceIds: z.array(Id).min(1), lastVerifiedAt: DateTime
});
export const EvidenceSchema = z.strictObject({
  id: Id, kind: z.enum(['paper', 'thesis']), title: Text,
  resourceIds: z.array(Id).min(1), sourceIds: z.array(Id).min(1), lastVerifiedAt: DateTime
});
export const DepartmentSchema = z.strictObject({ id: Id, name: Text, sourceIds: z.array(Id).min(1), groupType: z.enum(['department', 'shared']).default('department') });
export const GoalProfileSchema = z.strictObject({
  problemDomains: z.array(Text).max(15), coreTechnologies: z.array(Text).max(15),
  requiredCapabilities: z.array(Text).max(15), expectedOutputs: z.array(Text).max(15), keywords: z.array(Text).max(30)
});
export const ManifestSchema = z.strictObject({
  version: Id, generatedAt: DateTime, publication: z.enum(['prototype', 'approved']),
  reviewedBy: Text.optional(), reviewedAt: DateTime.optional(), selectionReason: Text,
  schemaVersion: z.literal(1)
}).superRefine((m, ctx) => {
  if (m.publication === 'approved' && (!m.reviewedBy || !m.reviewedAt)) ctx.addIssue({ code: 'custom', message: 'Human review required for publication' });
});
export const SnapshotSchema = z.strictObject({
  manifest: ManifestSchema, departments: z.array(DepartmentSchema).min(1),
  sources: z.array(SourceSchema), resources: z.array(ResourceSchema),
  relations: z.array(RelationSchema), evidence: z.array(EvidenceSchema)
}).superRefine((s, ctx) => {
  const groups = [s.departments, s.sources, s.resources, s.relations, s.evidence];
  for (const group of groups) if (new Set(group.map(x => x.id)).size !== group.length) ctx.addIssue({ code: 'custom', message: 'Duplicate ID' });
  const sources = new Set(s.sources.map(x => x.id));
  const resources = new Set(s.resources.map(x => x.id));
  const departments = new Set(s.departments.map(x => x.id));
  for (const record of [...s.departments, ...s.resources, ...s.relations, ...s.evidence]) {
    for (const id of record.sourceIds) if (!sources.has(id)) ctx.addIssue({ code: 'custom', message: `Unknown source ${id}` });
  }
  for (const r of s.resources) if (!departments.has(r.departmentId)) ctx.addIssue({ code: 'custom', message: `Unknown department ${r.departmentId}` });
  for (const r of s.relations) {
    if (!resources.has(r.from) || !resources.has(r.to) || r.from === r.to) ctx.addIssue({ code: 'custom', message: `Invalid relation ${r.id}` });
  }
  for (const e of s.evidence) for (const id of e.resourceIds) if (!resources.has(id)) ctx.addIssue({ code: 'custom', message: `Unknown evidence resource ${id}` });
  if (s.evidence.some(e => resources.has(e.id))) ctx.addIssue({ code: 'custom', message: 'Evidence must not be a resource' });
});
export const RecommendationSchema = z.strictObject({
  resource: ResourceSchema, source: z.array(SourceSchema).min(1), reason: Text,
  lastVerifiedAt: DateTime, verificationRequired: z.boolean(), score: z.number().finite(),
  relationIds: z.array(Id)
}).superRefine((r, ctx) => {
  if (r.source.some(s => !r.resource.sourceIds.includes(s.id))) ctx.addIssue({ code: 'custom', message: 'Recommendation source not attached to resource' });
});
export const FiltersSchema = z.strictObject({
  q: z.string().trim().max(300).default(''), kinds: z.array(ResourceKind).max(4).default([]),
  departmentIds: z.array(Id).max(20).default([])
});
export const SearchRequestSchema = FiltersSchema.extend({
  aiConsent: z.boolean().default(false), profile: GoalProfileSchema.optional()
}).superRefine((s, ctx) => {
  if (s.profile && !s.aiConsent) ctx.addIssue({ code: 'custom', message: 'AI consent required' });
});
export const InterpretRequestSchema = z.strictObject({ goal: z.string().trim().min(1).max(3000), aiConsent: z.literal(true) });
export const GraphNodeSchema = z.strictObject({ id: Id, name: Text, kind: z.enum(['researcher', 'lab', 'equipment', 'space', 'paper', 'thesis']), departmentId: Id, sourceIds: z.array(Id).min(1) });
export const GraphEdgeSchema = z.strictObject({ id: Id, source: Id, target: Id, label: Text, sourceIds: z.array(Id).min(1), lastVerifiedAt: DateTime });
export type Resource = z.infer<typeof ResourceSchema>;
export type Source = z.infer<typeof SourceSchema>;
export type Relation = z.infer<typeof RelationSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;
export type Department = z.infer<typeof DepartmentSchema>;
export type GoalProfile = z.infer<typeof GoalProfileSchema>;
export type Snapshot = z.infer<typeof SnapshotSchema>;
export type Recommendation = z.infer<typeof RecommendationSchema>;
export type Filters = z.infer<typeof FiltersSchema>;
export type SearchRequest = z.infer<typeof SearchRequestSchema>;
export type GraphNode = z.infer<typeof GraphNodeSchema>;
export type GraphEdge = z.infer<typeof GraphEdgeSchema>;
export type Graph = { nodes: GraphNode[]; edges: GraphEdge[]; hiddenNodes: number; hiddenEdges: number };
export type SearchResponse = { results: Recommendation[]; mode: 'ordinary' | 'ai' | 'fallback'; message?: string };
export type Catalog = { manifest: Snapshot['manifest']; departments: (Department & { counts: Record<Resource['kind'], number>; lastVerifiedAt: string | null })[]; sharedGroups: (Department & { counts: Record<Resource['kind'], number>; lastVerifiedAt: string | null })[]; totals: Record<Resource['kind'], number>; launchReady: boolean; gaps: string[] };

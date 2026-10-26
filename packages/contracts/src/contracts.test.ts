import { describe, expect, it } from 'vitest';
import { GoalProfileSchema, ResourceSchema, RelationSchema, ManifestSchema, SourceSchema, SnapshotSchema } from './index.ts';
const time = '2026-10-26T00:00:00Z';
const source = { id: 's', url: 'https://cse.snu.ac.kr/en/research/labs/4', title: '공식 안내', organization: '서울대학교', sourceType: 'official-page', retrievedAt: time, lastVerifiedAt: time };
const resource = { id: 'r', kind: 'lab', name: '연구실', summary: '공식 소개', departmentId: 'cse', keywords: [], sourceIds: ['s'], lastVerifiedAt: time, verificationRequired: false };
const snapshot = { manifest: { version: 'sample', schemaVersion: 1, generatedAt: time, publication: 'prototype', selectionReason: '계약 검증' }, departments: [{ id: 'cse', name: '컴퓨터공학부', sourceIds: ['s'] }], sources: [source], resources: [resource], relations: [], evidence: [] };
describe('public evidence boundary', () => {
  it('requires evidence on resources and relations', () => {
    expect(ResourceSchema.safeParse({ ...resource, sourceIds: [] }).success).toBe(false);
    expect(RelationSchema.safeParse({ id: 'e', from: 'r', to: 'r2', type: 'LEADS', label: '지도', sourceIds: [], lastVerifiedAt: time }).success).toBe(false);
  });
  it('rejects papers as resources and personal contact fields', () => {
    expect(ResourceSchema.safeParse({ ...resource, kind: 'paper' }).success).toBe(false);
    expect(ResourceSchema.safeParse({ ...resource, email: 'private@example.com' }).success).toBe(false);
    expect(SourceSchema.safeParse({ ...source, url: 'javascript:alert(1)' }).success).toBe(false);
    expect(SourceSchema.safeParse({ ...source, url: 'https://user:password@example.org/' }).success).toBe(false);
  });
  it('checks cross references and duplicate identities', () => {
    expect(SnapshotSchema.parse(snapshot).resources).toHaveLength(1);
    expect(SnapshotSchema.safeParse({ ...snapshot, sources: [] }).success).toBe(false);
    expect(SnapshotSchema.safeParse({ ...snapshot, resources: [resource, resource] }).success).toBe(false);
    expect(SnapshotSchema.safeParse({ ...snapshot, resources: [{ ...resource, departmentId: 'missing' }] }).success).toBe(false);
  });
  it('cannot label an unreviewed batch approved', () => {
    expect(ManifestSchema.safeParse({ ...snapshot.manifest, publication: 'approved' }).success).toBe(false);
  });
  it('accepts only the five editable goal fields', () => {
    expect(GoalProfileSchema.safeParse({ problemDomains: [], coreTechnologies: [], requiredCapabilities: [], expectedOutputs: [], keywords: [], resourceId: 'invented' }).success).toBe(false);
  });
});

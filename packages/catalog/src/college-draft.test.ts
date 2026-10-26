import { expect, it } from 'vitest';
import draft from '../../../data/college-draft.json' with { type: 'json' };
import { compileDraft } from '../../../data/compile-draft.ts';
import { sanitize } from '../../../apps/worker/src/privacy.ts';
import { catalog, graph, parseSnapshot, recommend } from './index.ts';

it('keeps the complete sourced college draft reproducible and pending human approval', async () => {
  const snapshot = parseSnapshot(draft);
  expect(await compileDraft()).toEqual(snapshot);
  expect(sanitize(draft).exclusions).toEqual([]);
  const summary = catalog(snapshot);
  expect(summary.departments).toHaveLength(12);
  expect(summary.sharedGroups).toHaveLength(2);
  expect(summary.totals).toEqual({ researcher: 329, lab: 105, equipment: 209, space: 20 });
  expect(summary.departments.every(d => d.counts.researcher >= 3 && d.counts.lab >= 3)).toBe(true);
  expect(summary.gaps).toContain('사람의 공개 배치 승인 대기');
  expect(summary.gaps).toContain('공식 전체 명단·상세·위치·논문 목표 검수 대기');
  expect(summary.launchReady).toBe(false);
  expect(snapshot.resources.every(r => r.verificationRequired)).toBe(true);
  expect(snapshot.relations.some(r => r.from.startsWith('prof-architecture-'))).toBe(false);
  for (const department of summary.departments) {
    const resources = snapshot.resources.filter(r => r.departmentId === department.id);
    expect(snapshot.evidence.some(e => e.resourceIds.some(id => resources.some(r => r.id === id)))).toBe(true);
    expect(recommend(snapshot, { q: '', kinds: [], departmentIds: [department.id] })).toHaveLength(resources.length);
  }
  const base = { q: '', kinds: [], departmentIds: [] };
  expect(graph(snapshot, base).nodes).toHaveLength(300);
  expect(graph(snapshot, base).nodes.some(n => n.kind === 'paper')).toBe(false);
  const expanded = graph(snapshot, base, { focus: 'lab-industrial-dsba', evidence: true });
  expect(expanded.nodes.some(n => n.id === 'paper-industrial-example')).toBe(true);
  const locations = graph(snapshot, base, { focus: 'eq-irf-105' });
  expect(locations.nodes.map(n => n.id)).toContain('space-irf-b112');
  expect(locations.edges.every(e => e.sourceIds.length > 0)).toBe(true);
});

import { expect, it } from 'vitest';
import { CampusSchema, SnapshotSchema } from '@ieum/contracts';
import sdata from '../../../data/college-draft.json';
import cdata from '../../../data/campus/campus-draft.json';
import { egoNetwork, networkModel } from './network';
const s = SnapshotSchema.parse(sdata), c = CampusSchema.parse(cdata), f = { q: '', kinds: [], departmentIds: [] };
const now = Date.parse('2026-11-24T00:00:00Z');
it('separates official relations, paper evidence and department distribution between buildings', () => {
  const realNow = Date.now; Date.now = () => now;
  try {
    const m = networkModel(c, s, f);
    expect(m.links.every(l => l.from !== l.to)).toBe(true);
    expect(m.links.filter(l => l.layer !== 'department').every(l => l.sourceIds.length > 0)).toBe(true);
    expect(m.links.filter(l => l.layer === 'department').every(l => l.label.endsWith('자원 분포'))).toBe(true);
    const total = m.stacks.reduce((n, st) => n + st.total, 0);
    expect(total).toBe(m.located.size);
  } finally { Date.now = realNow; }
});
it('builds an ego network whose direct ring only contains official relations', () => {
  const relation = s.relations.find(e => e.type === 'LEADS')!;
  const ego = egoNetwork(s, c, relation.to)!;
  expect(ego.nodes.some(n => n.ring === 1 && n.resource.id === relation.from)).toBe(true);
  for (const n of ego.nodes.filter(n => n.ring === 1)) expect(s.relations.some(e => (e.from === relation.to && e.to === n.resource.id) || (e.to === relation.to && e.from === n.resource.id))).toBe(true);
  expect(ego.nodes.filter(n => n.ring === 3).every(n => n.relation === '같은 건물' && n.sourceIds.length === 0)).toBe(true);
});

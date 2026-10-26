import { describe, expect, it } from 'vitest';
import seed from '../../../data/prototype.json' with { type: 'json' };
import { parseSnapshot, recommend, graph, catalog } from './index.ts';
const s = parseSnapshot(seed);
const base = { q: '', kinds: [], departmentIds: [] };
describe('catalog evidence and limits', () => {
  it('normalizes Korean spacing and reviewed synonyms', () => {
    expect(recommend(s, { ...base, q: '데이터과학' }).some(r => r.resource.id === 'lab-afds')).toBe(true);
    expect(recommend(s, { ...base, q: 'AI' }).some(r => r.resource.id === 'lab-bi')).toBe(true);
  });
  it('never fabricates resources for an empty department', () => {
    expect(graph(s, { ...base, departmentIds: ['industrial'] }).nodes).toHaveLength(0);
    expect(catalog(s).launchReady).toBe(false);
    expect(catalog(s).departments).toHaveLength(12);
  });
  it('keeps search highlighting on the existing graph', () => {
    expect(graph(s, { ...base, q: 'unknown' }).nodes).toHaveLength(s.resources.length);
    expect(recommend(s, { ...base, q: 'unknown' })).toHaveLength(0);
  });
  it('requires both filtered relation endpoints and honors depth', () => {
    const focus = graph(s, base, { focus: 'lab-afds', depth: 2 });
    expect(focus.nodes.map(n => n.id).sort()).toEqual(['lab-afds', 'prof-afds']);
    expect(focus.edges.every(e => e.sourceIds.length > 0)).toBe(true);
    expect(graph(s, { ...base, kinds: ['lab'] }, { focus: 'lab-afds' }).edges).toHaveLength(0);
  });
  it('caps nodes and does not return dangling edges', () => {
    const large = { ...s, resources: Array.from({ length: 620 }, (_, i) => ({ ...s.resources[0], id: `r-${i}` })), relations: [] };
    expect(graph(large, base).nodes).toHaveLength(300);
    const expanded = graph(large, base, { expanded: true });
    expect(expanded.nodes).toHaveLength(500);
    expect(expanded.hiddenNodes).toBe(120);
  });
  it('limits AI candidates to semantic matches and evidenced neighbors when no lexical query exists', () => {
    const results = recommend(s, base, new Map([['lab-bi', .9]]));
    expect(results.map(r => r.resource.id).sort()).toEqual(['lab-bi', 'prof-bi']);
  });
  it('marks weekly infrastructure as needing verification', () => {
    const changed = { ...s, resources: [{ ...s.resources[0], kind: 'equipment' as const, verificationRequired: false }] };
    expect(recommend(changed, base, new Map(), Date.parse('2026-11-10T00:00:00Z'))[0].verificationRequired).toBe(true);
  });
});

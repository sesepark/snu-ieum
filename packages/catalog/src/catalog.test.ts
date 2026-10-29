import { describe, expect, it } from 'vitest';
import college from '../../../data/college-draft.json' with { type: 'json' };
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
it('counts relationships omitted with capped nodes and gates document expansion', () => {
  const resources = Array.from({length: 310}, (_, i) => ({...s.resources[0], id: `n-${i}`}));
  const relations = resources.slice(1).map((r, i) => ({...s.relations[0], id: `e-${i}`, from: 'n-0', to: r.id}));
  const limited = graph({...s, resources, relations}, base);
  expect(limited.hiddenNodes).toBe(10); expect(limited.hiddenEdges).toBe(10);
  const withDocument = {...s, evidence: [{id:'fixture-paper', kind:'paper' as const, title:'테스트 근거', resourceIds:['lab-bi'], sourceIds:['s-bi'], lastVerifiedAt:'2026-10-26T00:00:00Z'}]};
  expect(graph(withDocument, base).nodes.some(n => n.kind === 'paper')).toBe(false);
  const expanded = graph(withDocument, base, {focus:'lab-bi', evidence:true});
  expect(expanded.nodes.some(n => n.kind === 'paper')).toBe(true);
  const ids = new Set(expanded.nodes.map(n => n.id));
  expect(expanded.edges.every(e => ids.has(e.source) && ids.has(e.target) && e.sourceIds.length > 0)).toBe(true);
});

it('treats shared infrastructure as a display group without inventing a department affiliation', () => {
  const shared = parseSnapshot({...s, departments:[...s.departments,{id:'shared',name:'공용시설',sourceIds:['s-departments'],groupType:'shared'}], resources:[...s.resources,{...s.resources[0],id:'fixture-equipment',kind:'equipment',departmentId:'shared'}]});
  const summary = catalog(shared);
  expect(summary.departments).toHaveLength(12); expect(summary.sharedGroups).toHaveLength(1);
  expect(summary.totals.equipment).toBe(1);
  expect(summary.gaps.some(gap => gap.includes('공용시설: 교수'))).toBe(false);
  expect(graph(shared, base).nodes.some(node => node.id === 'fixture-equipment')).toBe(true);
});

it('rejects a release that omits official departments or introduces an unchecked department', () => {
  const missing = {...s,departments:s.departments.filter(d=>d.id==='cse')};
  expect(catalog(missing).gaps.some(gap=>gap.includes('공식 학과 목록에서 누락'))).toBe(true);
  const unchecked = parseSnapshot({...s,departments:[...s.departments,{id:'unchecked',name:'검수 전 학과',sourceIds:['s-departments']}]});
  expect(catalog(unchecked).gaps.some(gap=>gap.includes('공식 학과 목록과 대조 필요'))).toBe(true);
});
it('finds explicit Korean variants and English flexible while preferring literal source text',()=>{
 const clone=structuredClone(s),original=clone.resources[0];
 clone.resources=[{...original,id:'literal-resource',name:'가나다',summary:'유연 전자 소자',keywords:[]},{...original,id:'variant-resource',name:'나라마',summary:'Flexible electronic devices',keywords:[]},{...original,id:'excluded-resource',name:'다라마',summary:'Inflexible production constraints',keywords:[]}];clone.relations=[];clone.evidence=[];
 const results=recommend(clone,{...base,q:'유연'});expect(results.map(r=>r.resource.id)).toEqual(['literal-resource','variant-resource']);expect(results[1].reason).toContain('다른 표현');
 expect(recommend(clone,{...base,q:'유연',departmentIds:['industrial']})).toEqual([]);
 expect(recommend(clone,{...base,q:'유연 우주'})).toEqual([]);
 clone.resources[1].summary='시계열 이상 탐지 및 원인 분석';expect(recommend(clone,{...base,q:'이상치'}).map(r=>r.resource.id)).toEqual(['variant-resource']);
 expect(clone.relations).toEqual([]);
});

it('finds explicitly described battery equipment using everyday Korean terminology', () => {
 const snapshot=parseSnapshot(college);
 const results=recommend(snapshot,{...base,q:'배터리'});
 expect(results.length).toBeGreaterThan(0);
 expect(results.every(c=>/배터리|베터리|batter(?:y|ies)|이차전지/i.test([c.resource.summary,...c.resource.keywords,c.resource.name].join(' ')))).toBe(true);
 expect(results.every(c=>c.source.length>0)).toBe(true);
});

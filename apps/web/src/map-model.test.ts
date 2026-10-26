import { expect, it } from 'vitest';
import draft from '../../../data/college-draft.json';
import { graph, parseSnapshot } from '@ieum/catalog';
import { model } from './map-model.ts';

it('removes empty group anchors from a relationship view while retaining the department anchor', () => {
  const snapshot = parseSnapshot(draft), filters = { q: '', kinds: [], departmentIds: [] };
  const whole = model(graph(snapshot, filters), snapshot.departments);
  const focused = model(graph(snapshot, filters, { focus: 'eq-irf-105', depth: 2 }), snapshot.departments, true);
  expect(whole.nodes.filter(n => n.kind === 'department')).toHaveLength(14);
  expect(focused.nodes.filter(n => n.kind === 'department').map(n => n.departmentId)).toEqual(['shared-irf']);
  expect(focused.nodes.filter(n => n.kind !== 'department')).toHaveLength(3);
  expect(focused.links).toHaveLength(2);
  const anchor = focused.nodes.find(n => n.kind === 'department')!;
  expect([anchor.fx, anchor.fy]).toEqual(whole.nodes.filter(n => n.kind === 'department').filter(n => n.departmentId === 'shared-irf').map(n => [n.fx, n.fy])[0]);
});

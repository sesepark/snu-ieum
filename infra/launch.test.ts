import { expect, it } from 'vitest';
import { parseSnapshot } from '@ieum/catalog';
import seed from '../data/prototype.json';
import { defaultView, launchCheck } from './launch.ts';
it('cannot release an unreviewed sparse prototype using empty checkmarks', () => {
  const result = launchCheck(parseSnapshot(seed), {});
  expect(result.ready).toBe(false); expect(result.gaps.length).toBeGreaterThan(12);
});
it('chooses the default view at the specified strict thresholds', () => {
  const base = { participants: 10, success2d: 9, success3d: 8, medianSeconds2d: 100, medianSeconds3d: 120, repeatedFatigue3d: false };
  expect(defaultView(base)).toBe('3d');
  expect(defaultView({ ...base, success3d: 7 })).toBe('2d');
  expect(defaultView({ ...base, medianSeconds3d: 121 })).toBe('2d');
  expect(defaultView({ ...base, repeatedFatigue3d: true })).toBe('2d');
});

import { expect, it } from 'vitest';
import { parseUrl, shareUrl, useExplore } from './state';
it('round trips shared state while excluding all user text', () => {
  const state = { view: '3d' as const, kinds: ['lab' as const], departmentIds: ['cse'], selected: 'lab-bi', goal: 'private', q: 'private' };
  const url = shareUrl(state);
  expect(url).not.toContain('private'); expect(url).not.toContain('goal'); expect(url).not.toContain('q=');
  expect(parseUrl(url)).toEqual({ view: '3d', kinds: ['lab'], departmentIds: ['cse'], selected: 'lab-bi' });
});
it('view changes retain filters, expansion, and selection', () => {
  useExplore.getState().restore({ view: '2d', kinds: ['lab'], departmentIds: ['cse'], selected: 'lab-bi' });
  useExplore.getState().expand(); useExplore.getState().setView('3d');
  const state = useExplore.getState();
  expect(state.selected).toBe('lab-bi'); expect(state.kinds).toEqual(['lab']); expect(state.depth).toBe(2);
});
it('validates URL filters and selected ids', () => {
  expect(parseUrl('view=unknown&kind=paper&selected=%3Cscript%3E').selected).toBeUndefined();
  expect(parseUrl('kind=paper').kinds).toEqual([]);
});

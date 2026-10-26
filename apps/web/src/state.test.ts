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
it('restores bounded building and camera state while rejecting malformed or excessive views',()=>{
 const state={view:'3d' as const,kinds:[],departmentIds:[],building:'snu-301',viewpoint:{x:10,y:20,zoom:4,bearing:35,pitch:55}};
 expect(parseUrl(shareUrl(state))).toEqual({...state,selected:undefined});
 for(const camera of ['0,0,Infinity,0,45','0,0,0,0,45','90000,0,1,0,45','0,0,1,0,100','0,0,1,0'])expect(parseUrl(`camera=${camera}`).viewpoint).toBeUndefined();
 useExplore.getState().restore(state);useExplore.getState().restore({view:'2d',kinds:[],departmentIds:[]});expect(useExplore.getState().building).toBeUndefined();expect(useExplore.getState().viewpoint).toBeUndefined();
});

import { describe, it, expect } from 'vitest';
import { CampusSchema, SnapshotSchema } from '@ieum/contracts';
import campusData from '../../../data/campus/campus-draft.json';
import snapshotData from '../../../data/college-draft.json';
import { parseCampus, mappedLocations } from './campus';
const snapshot = SnapshotSchema.parse(snapshotData);
describe('spatial evidence and version boundaries', () => {
  it('accepts real spatial draft but refuses production publication and a mismatched research version', () => {
    expect(parseCampus(campusData, snapshot).buildings.length).toBeGreaterThan(200);
    expect(() => parseCampus(campusData, snapshot, true)).toThrow('Human');
    expect(() => parseCampus({ ...campusData, resourceVersion: 'other' }, snapshot)).toThrow('versions');
  });
  it('never places unknown, outdated or incorrectly typed resource addresses on the map', () => {
    const campus=CampusSchema.parse(campusData), r=snapshot.resources.find(r=>r.kind==='lab')!;
    const l={id:'test',resourceId:r.id,buildingId:'snu-301',purpose:'lab' as const,room:null,status:'verified' as const,sourceIds:['snu-buildings'],addressText:'301동',lastVerifiedAt:'2026-10-27T00:00:00Z',reason:null};
    campus.locations=[l]; const now=Date.parse('2026-10-27T01:00:00Z');
    expect(mappedLocations(campus,snapshot,now)).toHaveLength(1);
    expect(mappedLocations({...campus,locations:[{...l,purpose:'office'}]},snapshot,now)).toHaveLength(0);
    expect(() => parseCampus({...campus,locations:[{...l,purpose:'office'}]},snapshot)).toThrow('purpose');
    expect(mappedLocations({...campus,resourceVersion:'other'},snapshot,now)).toHaveLength(0);
    expect(mappedLocations({...campus,locations:[{...l,status:'outdated',reason:'moved'}]},snapshot,now)).toHaveLength(0);
    expect(mappedLocations(campus,snapshot,now+31*86400000)).toHaveLength(0);
  });
});

it('retains the selected added lab and its confirmed neighbors ahead of the initial graph cap',async()=>{
 const{graph}=await import('./index');const id='lab-list-aerospace-a';const relation=snapshot.relations.find(e=>e.to===id)!;
 const result=graph(snapshot,{q:'',kinds:[],departmentIds:[]},{selected:id});
 expect(result.nodes[0].id).toBe(id);expect(result.nodes.some(n=>n.id===relation.from)).toBe(true);expect(result.edges.some(e=>e.id===relation.id)).toBe(true);
});
it('never treats an unidentified background shape as a verified resource address',()=>{
 const c=CampusSchema.parse(campusData);
 for(const l of c.locations.filter(l=>l.status==='verified'))expect(c.buildings.find(b=>b.id===l.buildingId)?.number).toBeTruthy();
 const cryo=c.locations.find(l=>l.resourceId==='space-irf-b112')!;expect(cryo.buildingId).toBe('snu-139-1');
 expect(c.locations.find(l=>l.resourceId==='eq-irf-109')!.status).not.toBe('verified');
});

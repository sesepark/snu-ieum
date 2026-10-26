import{expect,it}from'vitest';
import{CampusSchema,SnapshotSchema}from'@ieum/contracts';
import sdata from'../../../data/college-draft.json';
import cdata from'../../../data/campus/campus-draft.json';
import{buildingModel,project,surface}from'./campus-model';
const s=SnapshotSchema.parse(sdata),c=CampusSchema.parse(cdata),f={q:'',kinds:[],departmentIds:[]};
it('groups co-located resources by the actual building instead of assigning artificial internal coordinates',()=>{
 const m=buildingModel(c,s,f,new Set(s.resources.map(r=>r.id)),{nodes:[],edges:[],hiddenNodes:0,hiddenEdges:0});
 expect(m.markers.find(m=>m.building.id==='snu-139')!.resourceIds.length).toBe(34);
 const lab=s.resources.find(r=>r.kind==='lab')!;
 expect(m.markers.some(m=>m.resourceIds.includes(lab.id))).toBe(false);
 expect(m.unlocated).toBeGreaterThan(0);expect(project([126.954,37.4575])).toEqual([0,-0]);
 expect(surface(c,0,0)).toBeGreaterThan(0);
});
it('never creates research relation lines from a topic match',()=>{
 const id=s.resources.find(r=>r.kind==='equipment')!.id;
 const m=buildingModel(c,s,{...f,q:'전자'},new Set([id]),{nodes:[],edges:[],hiddenNodes:0,hiddenEdges:0},id);
 expect(m.links).toEqual([]);
});

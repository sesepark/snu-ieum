import{expect,it}from'vitest';
import{resolve}from'node:path';
import{SnapshotSchema}from'@ieum/contracts';import snapshotData from'../../../data/college-draft.json';
import{loadSpatialFiles}from'./spatial';import{createApp}from'./app';
const snapshot=SnapshotSchema.parse(snapshotData),paths={campus:resolve('data/campus/campus-draft.json'),coverage:resolve('data/coverage/coverage-draft.json')};
it('serves consistent campus and field evidence in development while refusing unapproved production spatial data',async()=>{
 const spatial=async()=>loadSpatialFiles(snapshot,paths),app=await createApp({snapshot:async()=>snapshot},{prototype:true,spatial});
 try{
  const campus=await app.inject('/v1/campus');expect(campus.statusCode).toBe(200);expect(campus.json().resourceVersion).toBe(snapshot.manifest.version);
  const quality=await app.inject('/v1/coverage');expect(quality.json().report.ready).toBe(false);
  const detail=await app.inject('/v1/resources/eq-isrc-275');expect(detail.statusCode).toBe(200);expect(detail.json().spatial.profile.fields.model.value).toBe('4522');expect(detail.json().spatial.locations[0].buildingId).toBeNull();
  const catalog=await app.inject('/v1/catalog');expect(catalog.json().launchReady).toBe(false);expect(catalog.json().gaps.length).toBeGreaterThan(20);
  await expect(loadSpatialFiles(snapshot,paths,true)).rejects.toThrow('Human');
 }finally{await app.close();}
});
it('does not expose a mismatched spatial batch even while ordinary resource exploration remains available',async()=>{
 const app=await createApp({snapshot:async()=>snapshot},{prototype:true,spatial:async()=>{throw new Error('mismatched batch');}});
 try{expect((await app.inject('/v1/campus')).statusCode).toBe(503);expect((await app.inject('/v1/catalog')).statusCode).toBe(200);expect((await app.inject('/v1/resources/eq-irf-105')).statusCode).toBe(200);}finally{await app.close();}
});
